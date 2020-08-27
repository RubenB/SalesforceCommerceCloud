var Logger = require('*/cartridge/scripts/utils/logger');
var mollieEntities = require('*/cartridge/scripts/services/mollie/mollieEntities');

/**
 *
 *
 * @param {Object} params - params object
 * @returns {Object} payload - returns payload
 */
function payloadBuilder(params) {
    return {
        amount: params.amount,
        lines: params.lines
    };
}

/**
 *
 *
 * @param {Object} result - Mollie Service Response
 * @returns {Object} response
 */
function responseMapper(result) {
    Logger.debug('MOLLIE :: CreateOrderRefund: ' + JSON.stringify(result));
    if (!result || typeof result === 'string') {
        return {
            refund: new mollieEntities.Refund(),
            raw: result || null
        };
    }
    return {
        refund: new mollieEntities.Refund(result),
        raw: JSON.stringify(result)
    };
}

exports.payloadBuilder = payloadBuilder;
exports.responseMapper = responseMapper;
