module.exports = {
    GET_METHODS: {
        method: 'GET',
        path: '/v2/methods/all?include=issuers',
        serviceName: 'Mollie.GetMethods'
    },
    GET_METHOD: {
        method: 'GET',
        path: '/v2/methods/{methodId}',
        serviceName: 'Mollie.GetMethod'
    }
};
