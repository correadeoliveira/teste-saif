const { rpc, upsert } = require("../state.cjs");

function createClient() {
    return {
        rpc,
        from: () => ({ upsert }),
    };
}

module.exports = { createClient };
