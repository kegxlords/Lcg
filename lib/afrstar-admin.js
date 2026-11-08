import { supabaseAdmin } from './supabase.js';
import {
  createPayoutOrder,
  getAfrStarConfig,
  newOrderSn,
  registerOrderWithYolotask
} from './afrstar.js';

function response(statusCode, body) {
  return { statusCode, body };
}

export async function startAfrStarPayout(withdrawal) {
  let config;
  try {
    config = getAfrStarConfig();
  } catch (error) {
    console.error('[AfrStar config error]:', error.message);
    return response(503, { error: 'AfrStar payouts are not configured on this server.' });
  }

  const { data: prepared, error: prepareError } = await supabaseAdmin.rpc('prepare_afrstar_payout', {
    p_withdrawal_id: withdrawal.id,
    p_order_sn: newOrderSn('payout')
  });
  if (prepareError || !prepared) {
    console.error('[AfrStar payout prepare error]:', prepareError);
    return response(500, { error: 'Could not prepare this payout.' });
  }

  let order = prepared;
  if (['submitted', 'creating'].includes(order.order_status)) {
    return response(200, { success: true, awaiting_callback: true, order_sn: order.order_sn });
  }
  if (!['awaiting_registration', 'registered'].includes(order.order_status)) {
    return response(409, { error: 'This AfrStar payout is in reconciliation and will not be resubmitted automatically.' });
  }

  try {
    await registerOrderWithYolotask(order.order_sn, config.callbackUrl, config);
  } catch (error) {
    console.error('[YOLOTASK payout registration error]:', error);
    return response(502, { error: 'YOLOTASK did not accept callback registration, so no AfrStar payout was created. You may retry approval.' });
  }

  if (order.order_status === 'awaiting_registration') {
    const { data: registered, error: stateError } = await supabaseAdmin
      .from('afrstar_orders')
      .update({ order_status: 'registered', updated_at: new Date().toISOString(), error_message: null })
      .eq('id', order.id)
      .eq('order_status', 'awaiting_registration')
      .select('*')
      .maybeSingle();
    if (stateError) {
      return response(500, { error: 'Callback was registered, but payout state could not be saved. No payout was sent.' });
    }
    if (registered) order = registered;
    else {
      const { data: latest, error: latestError } = await supabaseAdmin
        .from('afrstar_orders')
        .select('*')
        .eq('id', order.id)
        .single();
      if (latestError || !latest) return response(500, { error: 'Could not reload the payout state.' });
      order = latest;
    }
  }

  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('afrstar_orders')
    .update({ order_status: 'creating', updated_at: new Date().toISOString() })
    .eq('id', order.id)
    .eq('order_status', 'registered')
    .select('id')
    .maybeSingle();
  if (claimError) return response(500, { error: 'Could not safely start the payout.' });
  if (!claimed) return response(200, { success: true, awaiting_callback: true, order_sn: order.order_sn });

  let providerOrder;
  try {
    providerOrder = await createPayoutOrder({
      orderSn: order.order_sn,
      amount: order.amount,
      name: withdrawal.account_name,
      account: withdrawal.account_number,
      bankCode: order.bank_code
    }, config);
  } catch (error) {
    console.error('[AfrStar payout request error]:', error);
    await supabaseAdmin.from('afrstar_orders')
      .update({
        order_status: 'review',
        error_message: 'AfrStar payout result requires reconciliation.',
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id)
      .eq('order_status', 'creating');
    return response(502, { error: 'AfrStar did not confirm the payout result. It will not be retried automatically; reconcile this order before taking action.' });
  }

  const { error: saveError } = await supabaseAdmin.from('afrstar_orders')
    .update({
      order_status: 'submitted',
      platform_osn: providerOrder.platformOsn,
      error_message: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', order.id)
    .eq('order_status', 'creating');
  if (saveError) {
    console.error('[AfrStar payout save error]:', saveError);
    return response(500, { error: 'AfrStar may have accepted the payout, but its result could not be saved. Do not resubmit; reconcile this order.' });
  }

  return response(200, { success: true, awaiting_callback: true, order_sn: order.order_sn });
}
