-- Atomic financial operations for LCG.
-- Apply this migration before deploying the API handlers that call these RPCs.
-- SECURITY DEFINER functions are executable only by the server-side service_role.

CREATE OR REPLACE FUNCTION public.buy_product_atomic(
  p_user_id uuid,
  p_product_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_product public.products%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
  v_investment public.investments%ROWTYPE;
  v_start_at timestamptz := transaction_timestamp();
  v_end_at timestamptz;
  v_new_balance numeric;
BEGIN
  IF p_user_id IS NULL OR p_product_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
  END IF;

  -- Lock the product row so concurrent purchases cannot exceed limited capacity.
  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCT_NOT_FOUND';
  END IF;
  IF v_product.is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCT_NOT_AVAILABLE';
  END IF;
  IF COALESCE(v_product.is_coming_soon, FALSE) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCT_COMING_SOON';
  END IF;
  IF v_product.price IS NULL OR v_product.price <= 0
     OR v_product.duration_days IS NULL OR v_product.duration_days <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_PRODUCT';
  END IF;
  IF v_product.category = 'Limited'
     AND v_product.max_capacity IS NOT NULL
     AND COALESCE(v_product.current_sold, 0) >= v_product.max_capacity THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCT_SOLD_OUT';
  END IF;

  -- Lock and debit the current wallet balance in this transaction.
  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'WALLET_NOT_FOUND';
  END IF;
  IF COALESCE(v_wallet.balance, 0) < v_product.price THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INSUFFICIENT_BALANCE';
  END IF;

  UPDATE public.wallets
  SET balance = balance - v_product.price,
      updated_at = transaction_timestamp()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  v_end_at := v_start_at + (v_product.duration_days * INTERVAL '1 day');

  INSERT INTO public.investments (
    user_id,
    product_id,
    amount,
    expected_profit,
    start_date,
    end_date,
    status,
    last_payout_date,
    capital_returned
  ) VALUES (
    p_user_id,
    v_product.id,
    v_product.price,
    v_product.profit,
    v_start_at,
    v_end_at,
    'active',
    NULL,
    FALSE
  )
  RETURNING * INTO v_investment;

  IF v_product.category = 'Limited' THEN
    UPDATE public.products
    SET current_sold = COALESCE(current_sold, 0) + 1
    WHERE id = v_product.id;
  END IF;

  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    status,
    reference,
    description
  ) VALUES (
    p_user_id,
    'investment_purchase',
    v_product.price,
    'approved',
    'INV_' || UPPER(SUBSTRING(v_investment.id::text, 1, 8)),
    'Invested in ' || v_product.name
  );

  INSERT INTO public.wheel_spins (
    user_id,
    amount_won,
    trigger_type
  ) VALUES (
    p_user_id,
    0,
    'self_invest'
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'investment', TO_JSONB(v_investment),
    'balance', v_new_balance
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.buy_product_atomic(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buy_product_atomic(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.request_withdrawal_atomic(
  p_user_id uuid,
  p_amount numeric,
  p_bank_name text,
  p_account_number text,
  p_account_name text,
  p_min_withdrawal numeric,
  p_fee_percentage numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_withdrawal public.withdrawals%ROWTYPE;
  v_fee numeric;
  v_net_amount numeric;
  v_new_balance numeric;
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount <= 0
     OR NULLIF(BTRIM(p_bank_name), '') IS NULL
     OR NULLIF(BTRIM(p_account_number), '') IS NULL
     OR NULLIF(BTRIM(p_account_name), '') IS NULL
     OR p_min_withdrawal IS NULL OR p_min_withdrawal < 0
     OR p_fee_percentage IS NULL OR p_fee_percentage < 0 OR p_fee_percentage > 100 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_WITHDRAWAL';
  END IF;
  IF p_amount < p_min_withdrawal THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MINIMUM_WITHDRAWAL';
  END IF;

  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'WALLET_NOT_FOUND';
  END IF;
  IF COALESCE(v_wallet.balance, 0) < p_amount THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INSUFFICIENT_BALANCE';
  END IF;

  v_fee := ROUND(p_amount * p_fee_percentage / 100, 2);
  v_net_amount := p_amount - v_fee;

  UPDATE public.wallets
  SET balance = balance - p_amount,
      updated_at = transaction_timestamp()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.withdrawals (
    user_id,
    amount,
    bank_name,
    account_number,
    account_name,
    status
  ) VALUES (
    p_user_id,
    p_amount,
    BTRIM(p_bank_name),
    BTRIM(p_account_number),
    BTRIM(p_account_name),
    'pending'
  )
  RETURNING * INTO v_withdrawal;

  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    status,
    reference,
    description
  ) VALUES (
    p_user_id,
    'withdrawal',
    p_amount,
    'pending',
    'WD_' || UPPER(SUBSTRING(v_withdrawal.id::text, 1, 8)),
    'Withdrawal request: ₦' || TO_CHAR(p_amount, 'FM999999999999990.00') ||
      ' (Fee: ₦' || TO_CHAR(v_fee, 'FM999999999999990.00') || ')'
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'withdrawal', TO_JSONB(v_withdrawal),
    'fee', v_fee,
    'net_amount', v_net_amount,
    'balance', v_new_balance
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.request_withdrawal_atomic(uuid, numeric, text, text, text, numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal_atomic(uuid, numeric, text, text, text, numeric, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_wheel_spin_atomic(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_spin public.wheel_spins%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
  v_prize numeric;
  v_new_balance numeric;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REQUEST';
  END IF;

  -- SKIP LOCKED prevents parallel requests from claiming the same available spin.
  SELECT * INTO v_spin
  FROM public.wheel_spins
  WHERE user_id = p_user_id
    AND is_claimed = FALSE
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NO_AVAILABLE_SPIN';
  END IF;

  SELECT fixed_prize_amount INTO v_prize
  FROM public.wheel_config
  WHERE id = 1;
  v_prize := COALESCE(v_prize, 600);
  IF v_prize < 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REWARD';
  END IF;

  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'WALLET_NOT_FOUND';
  END IF;

  UPDATE public.wheel_spins
  SET is_claimed = TRUE,
      amount_won = v_prize
  WHERE id = v_spin.id;

  UPDATE public.wallets
  SET balance = balance + v_prize,
      updated_at = transaction_timestamp()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    status,
    reference,
    description
  ) VALUES (
    p_user_id,
    'wheel_win',
    v_prize,
    'approved',
    'WHEEL_' || UPPER(SUBSTRING(v_spin.id::text, 1, 8)),
    'Lucky Wheel Win'
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'prize', v_prize,
    'new_balance', v_new_balance
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_wheel_spin_atomic(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_wheel_spin_atomic(uuid) TO service_role;
