import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import slash from 'slash';

import consoleFactory, { setConsoleEnvData } from '@extras/console';
const console = consoleFactory();


/**
 * Helpers
 */
const cleanPath = (x: string) => { return slash(path.normalize(x)); };
const logDie = (x: string) => {
    console.error(x);
    process.exit(1);
};
const getBuild = (ver: any) => {
    try {
        const res = /v1\.0\.0\.(\d{4,5})\s*/.exec(ver);
        // @ts-expect-error: let it throw
        return parseInt(res[1]);
    } catch (error) {
        return 9999;
    }
};
const getConvarBool = (convarName: string) => {
    const cvar = GetConvar(convarName, 'false').trim().toLowerCase();
    return ['true', '1', 'on'].includes(cvar);
};
const getConvarString = (convarName: string) => {
    const cvar = GetConvar(convarName, 'false').trim();
    return (cvar === 'false') ? false : cvar;
};


/**
 * txAdmin Env
 */
//Get OSType
const osTypeVar = os.type();
let osType, isWindows;
if (osTypeVar == 'Windows_NT') {
    osType = 'windows';
    isWindows = true;
} else if (osTypeVar == 'Linux') {
    osType = 'linux';
    isWindows = false;
} else {
    logDie(`OS type not supported: ${osTypeVar}`);
}

//Get resource name
const resourceName = GetCurrentResourceName();

//Getting fxserver version
//4380 = GetVehicleType was exposed server-side
//4548 = more or less when node v16 was added
//4574 = add missing PRINT_STRUCTURED_TRACE declaration
//4574 = add resource field to PRINT_STRUCTURED_TRACE
//5894 = CREATE_VEHICLE_SERVER_SETTER
//6185 = added ScanResourceRoot (not yet in use)
//6508 = unhandledRejection is now handlable, we need this due to discord.js's bug
const minFXServerVersion = 5894;
const fxServerVersion = getBuild(getConvarString('version'));
if (fxServerVersion === 9999) {
    console.error('It looks like you are running a custom build of fxserver.');
    console.error('And because of that, there is no guarantee that txAdmin will work properly.');
} else if (!fxServerVersion) {
    logDie(`This version of FXServer is NOT compatible with txAdmin. Please update it to build ${minFXServerVersion} or above. (version convar not set or in the wrong format)`);
} else if (fxServerVersion < minFXServerVersion) {
    logDie(`This version of FXServer is too outdated and NOT compatible with txAdmin, please update to artifact/build ${minFXServerVersion} or newer!`);
}

//Getting txAdmin version
const txAdminVersion = GetResourceMetadata(resourceName, 'version', 0);
if (typeof txAdminVersion !== 'string' || txAdminVersion == 'null') {
    logDie('txAdmin version not set or in the wrong format');
}

//Get txAdmin Resource Path
let txAdminResourcePath;
const txAdminResourcePathConvar = GetResourcePath(resourceName);
if (typeof txAdminResourcePathConvar !== 'string' || txAdminResourcePathConvar == 'null') {
    logDie('Could not resolve txAdmin resource path');
} else {
    txAdminResourcePath = cleanPath(txAdminResourcePathConvar);
}

//Get citizen Root
const citizenRootConvar = getConvarString('citizen_root');
if (!citizenRootConvar) {
    logDie('citizen_root convar not set');
}
const fxServerPath = cleanPath(citizenRootConvar as string);

//Setting data path
let dataPath;
const txDataPathConvar = getConvarString('txDataPath');
if (!txDataPathConvar) {
    const dataPathSuffix = (isWindows) ? '..' : '../../../';
    dataPath = cleanPath(path.join(fxServerPath, dataPathSuffix, 'txData'));
} else {
    dataPath = cleanPath(txDataPathConvar);
}
try {
    if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath);
} catch (error) {
    logDie(`Failed to check or create '${dataPath}' with error: ${(error as Error).message}`);
}

//Check paths for non-ASCII characters
//NOTE: Non-ASCII in one of those paths (don't know which) will make NodeJS crash due to a bug in v8 (or something)
//      when running localization methods like Date.toLocaleString().
//      There was also an issue with the slash() lib and with the +exec on FXServer
const nonASCIIRegex = /[^\x00-\x80]+/;
if (nonASCIIRegex.test(fxServerPath) || nonASCIIRegex.test(dataPath)) {
    console.error('Due to environmental restrictions, your paths CANNOT contain non-ASCII characters.');
    console.error('Example of non-ASCII characters: çâýå, ρέθ, ñäé, ēļæ, глж, เซิร์, 警告.');
    console.error('Please make sure FXServer is not in a path contaning those characters.');
    console.error(`If on windows, we suggest you moving the artifact to "C:/fivemserver/${fxServerVersion}/".`);
    console.log(`FXServer path: ${fxServerPath}`);
    console.log(`txData path: ${dataPath}`);
    process.exit(1);
}


/**
 * Convars - Debug
 */
const isDevMode = getConvarBool('txAdminDevMode');
const verboseConvar = getConvarBool('txAdminVerbose');
const debugPlayerlistGenerator = getConvarBool('txDebugPlayerlistGenerator');
const debugExternalSource = getConvarString('txDebugExternalSource');


/**
 * Host type check
 */
//Checking for ZAP Configuration file
const zapCfgFile = path.join(dataPath, 'txAdminZapConfig.json');
let isZapHosting: boolean;
let forceInterface;
let forceFXServerPort;
let txAdminPort;
let loginPageLogo;
let defaultMasterAccount;
let deployerDefaults;
const loopbackInterfaces = ['::1', '127.0.0.1', '127.0.1.1'];
const isPterodactyl = !isWindows && process.env?.TXADMIN_ENABLE === '1';
if (fs.existsSync(zapCfgFile)) {
    isZapHosting = !isPterodactyl;
    console.log('Loading ZAP-Hosting configuration file.');
    let zapCfgData;
    try {
        zapCfgData = JSON.parse(fs.readFileSync(zapCfgFile, 'utf8'));
        forceInterface = zapCfgData.interface;
        forceFXServerPort = zapCfgData.fxServerPort;
        txAdminPort = zapCfgData.txAdminPort;
        loginPageLogo = zapCfgData.loginPageLogo;
        defaultMasterAccount = false;
        deployerDefaults = {
            license: zapCfgData.defaults.license,
            maxClients: zapCfgData.defaults.maxClients,
            mysqlHost: zapCfgData.defaults.mysqlHost,
            mysqlPort: zapCfgData.defaults.mysqlPort,
            mysqlUser: zapCfgData.defaults.mysqlUser,
            mysqlPassword: zapCfgData.defaults.mysqlPassword,
            mysqlDatabase: zapCfgData.defaults.mysqlDatabase,
        };
        if (zapCfgData.customer) {
            if (typeof zapCfgData.customer.name !== 'string') throw new Error('customer.name is not a string.');
            if (zapCfgData.customer.name.length < 3) throw new Error('customer.name too short.');
            if (typeof zapCfgData.customer.password_hash !== 'string') throw new Error('customer.password_hash is not a string.');
            if (!zapCfgData.customer.password_hash.startsWith('$2y$')) throw new Error('customer.password_hash is not a bcrypt hash.');
            defaultMasterAccount = {
                name: zapCfgData.customer.name,
                password_hash: zapCfgData.customer.password_hash,
            };
        }

        loopbackInterfaces.push(forceInterface);

        if (!isDevMode) fs.unlinkSync(zapCfgFile);
    } catch (error) {
        logDie(`Failed to load with ZAP-Hosting configuration error: ${(error as Error).message}`);
    }
} else {
    isZapHosting = false;
    forceFXServerPort = false;
    loginPageLogo = false;
    defaultMasterAccount = false;
    deployerDefaults = false;

    const txAdminPortConvar = GetConvar('txAdminPort', '40120').trim();
    if (!/^\d+$/.test(txAdminPortConvar)) logDie('txAdminPort is not valid.');
    txAdminPort = parseInt(txAdminPortConvar);

    const txAdminInterfaceConvar = getConvarString('txAdminInterface');
    if (!txAdminInterfaceConvar) {
        forceInterface = false;
    } else {
        if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(txAdminInterfaceConvar)) logDie('txAdminInterface is not valid.');
        forceInterface = txAdminInterfaceConvar;
        loopbackInterfaces.push(forceInterface);
    }
}
if (verboseConvar) {
    console.dir({ isPterodactyl, isZapHosting, forceInterface, forceFXServerPort, txAdminPort, loginPageLogo, deployerDefaults });
}

//Setting the variables in console without it having to importing from here (cyclical dependency)
setConsoleEnvData(
    txAdminVersion,
    txAdminResourcePath as string,
    isDevMode,
    verboseConvar
);

/**
 * Exports
 */
export const txEnv = Object.freeze({
    osType,
    isWindows,
    fxServerVersion,
    txAdminVersion,
    txAdminResourcePath,
    fxServerPath,
    dataPath
});

export const convars = Object.freeze({
    //Convars - Debug
    isDevMode,
    debugPlayerlistGenerator,
    debugExternalSource,
    //Convars - zap dependant
    isPterodactyl,
    isZapHosting,
    forceInterface,
    forceFXServerPort,
    txAdminPort,
    loginPageLogo,
    defaultMasterAccount,
    deployerDefaults,
    loopbackInterfaces,
});
