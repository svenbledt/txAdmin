export default {
    fxserverPath: 'E:\\FiveM\\6302\\fxserver.exe',
    debouncerInterval: 250,
    preReleaseExpirationDays: 21,
    txAdminArgs: [
        '+set', 'txAdminDevMode', 'true',
        '+set', 'txAdminVerbose', 'true',
        // '+set', 'txAdminPort', '40121',
        // '--trace-warnings',
        
        //FIXME: broken
        // '+set', 'txDebugPlayerlistGenerator', 'true',
        // '+set', 'txDebugExternalSource', 'xxxxxxxx:30120',
    ],
    copy: [
        'README.md',
        'LICENSE',
        'docs/',
        'fxmanifest.lua',
        'entrypoint.js',
        'resource/',
        'web/',
    ],
}
