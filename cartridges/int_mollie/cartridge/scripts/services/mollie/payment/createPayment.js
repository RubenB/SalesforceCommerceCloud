var URLUtils = require('dw/web/URLUtils');
var Logger = require('*/cartridge/scripts/utils/logger');
var mollieEntities = require('*/cartridge/scripts/services/mollie/mollieEntities');
var sfccEntities = require('*/cartridge/scripts/services/mollie/sfccEntities');

/**
 *
 *
 * @param {Object} params - params object
 * @returns {Object} payload - returns payload
 */
function payloadBuilder(params) {
    var payload = {
        amount: new sfccEntities.Currency(params.totalGrossPrice),
        description: "Order: " + params.orderId,
        redirectUrl: URLUtils.https('MolliePayment-Redirect', 'orderId', params.orderId).toString(),
        webhookUrl: URLUtils.https('MolliePayment-Hook', 'orderId', params.orderId).toString(),
        locale: request.getLocale(),
        method: params.methodId
    }
    if (params.issuer) {
        payload.issuer = params.issuer;
    }
    return payload;
}

/**
 *
 *
 * @param {Object} result - Mollie Service Response
 * @returns {Object} response
 */
function responseMapper(result) {
    Logger.debug('MOLLIE :: CreatePayment: ' + JSON.stringify(result));
    if (!result || typeof result === 'string') {
        return {
            payment: new mollieEntities.Payment(),
            raw: result || null
        };
    }
    return {
        payment: new mollieEntities.Payment(result),
        raw: JSON.stringify(result)
    };
}

exports.payloadBuilder = payloadBuilder;
exports.responseMapper = responseMapper;
