const noLookAlikesAlphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; //i,o removed
export default {
    validIdentifiers: {
        // https://github.com/discordjs/discord.js/pull/9144
        // validated in txtracker dataset
        discord: /^discord:\d{17,20}$/,
        fivem: /^fivem:\d{1,8}$/,
        license: /^license:[0-9A-Fa-f]{40}$/,
        license2: /^license2:[0-9A-Fa-f]{40}$/,
        live: /^live:\d{14,20}$/,
        steam: /^steam:1100001[0-9A-Fa-f]{8}$/,
        xbl: /^xbl:\d{14,20}$/,
    },
    regexValidHwidToken: /^[0-9A-Fa-f]{1,2}:[0-9A-Fa-f]{64}$/,
    regexSvLicenseOld: /^\w{32}$/,
    regexSvLicenseNew: /^cfxk_\w{1,60}_\w{1,20}$/,
    regexValidIP: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
    regexActionID: new RegExp(`^[${noLookAlikesAlphabet}]{4}-[${noLookAlikesAlphabet}]{4}$`),
    regexWhitelistReqID: new RegExp(`R[${noLookAlikesAlphabet}]{4}`),
    noLookAlikesAlphabet,
};
