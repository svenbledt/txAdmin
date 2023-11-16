const modulename = 'WebServer:ProviderCallback';
import crypto from 'node:crypto';
import { isValidRedirectPath } from '@core/extras/helpers';
import consoleFactory from '@extras/console';
const console = consoleFactory(modulename);

//Helper functions
const isUndefined = (x) => { return (typeof x === 'undefined'); };
const returnJustMessage = (ctx, errorTitle, errorMessage) => {
    return ctx.utils.render('login', { template: 'justMessage', errorTitle, errorMessage });
};

/**
 * Handles the provider login callbacks
 * @param {object} ctx
 */
export default async function ProviderCallback(ctx) {
    //Sanity check
    if (
        isUndefined(ctx.params.provider)
        || isUndefined(ctx.query.state)
    ) {
        return ctx.utils.error(400, 'Invalid Request');
    }
    const provider = ctx.params.provider;
    const reqState = ctx.query.state;

    if (provider !== 'citizenfx') {
        return returnJustMessage(ctx, 'Provider not implemented... yet');
    }

    if (typeof ctx.query.error_description === 'string') {
        return returnJustMessage(
            ctx,
            ctx.query.error_description,
            'Please refresh the page and try again.',
        );
    }

    //Check the state changed
    const stateSeed = `txAdmin:${ctx.session._sessCtx.externalKey}`;
    const stateExpected = crypto.createHash('SHA1').update(stateSeed).digest('hex');
    if (reqState != stateExpected) {
        return returnJustMessage(
            ctx,
            'This link has expired.',
            'Please refresh the page and try again.',
        );
    }

    //Exchange code for access token
    let tokenSet;
    try {
        const currentURL = ctx.protocol + '://' + ctx.get('host') + `/auth/${provider}/callback`;
        tokenSet = await globals.adminVault.providers.citizenfx.processCallback(ctx, currentURL, ctx.session._sessCtx.externalKey);
    } catch (error) {
        console.warn(`Code Exchange error: ${error.message}`);
        if (!isUndefined(error.tolerance)) {
            return returnJustMessage(
                ctx,
                'Please Update/Synchronize your VPS clock.',
                'Failed to login because this host\'s time is wrong. Please make sure to synchronize it with the internet.',
            );
        } else if (error.code === 'ETIMEDOUT') {
            return returnJustMessage(
                ctx,
                'Connection to FiveM servers timed out:',
                'Please try again or login using your existing username and backup password.',
            );
        } else if (error.message.startsWith('state mismatch')) {
            return returnJustMessage(
                ctx,
                'Invalid Browser Session.',
                'You may have restarted txAdmin right before entering this page, or copied the link to another browser. Please try again.',
            );
        } else {
            return returnJustMessage(ctx, 'Code Exchange error:', error.message);
        }
    }

    //Get userinfo
    let userInfo;
    try {
        userInfo = await globals.adminVault.providers.citizenfx.getUserInfo(tokenSet.access_token);
    } catch (error) {
        console.verbose.error(`Get UserInfo error: ${error.message}`);
        return returnJustMessage(ctx, 'Get UserInfo error:', error.message);
    }

    //Getting identifier
    let identifier;
    try {
        const res = /\/user\/(\d{1,8})/.exec(userInfo.nameid);
        identifier = `fivem:${res[1]}`;
    } catch (error) {
        return returnJustMessage(
            ctx,
            'Invalid nameid identifier.',
            `Could not extract the user identifier from the URL below. Please report this to the txAdmin dev team.\n${userInfo.nameid.toString()}`,
        );
    }

    //Check & Login user
    try {
        const admin = globals.adminVault.getAdminByIdentifiers([identifier]);
        if (!admin) {
            ctx.session.auth = {};
            return returnJustMessage(
                ctx,
                `The Cfx.re account '${userInfo.name}' is not an admin.`,
                'This username is not assigned to any registered account. You can also try to login using your username and backup password.',
            );
        }

        //Setting session
        ctx.session.auth = await globals.adminVault.providers.citizenfx.getUserSession(tokenSet, userInfo, identifier);
        ctx.session.auth.username = admin.name;

        //Save the updated provider identifier & data to the admins file
        await globals.adminVault.refreshAdminSocialData(admin.name, 'citizenfx', identifier, userInfo);

        ctx.utils.logAction(`logged in from ${ctx.ip} via citizenfx`);
        globals?.statisticsManager.loginOrigins.count(ctx.txVars.hostType);
        globals?.statisticsManager.loginMethods.count('citizenfx');
        const redirectPath = (isValidRedirectPath(ctx.session?.socialLoginRedirect)) ? ctx.session.socialLoginRedirect : '/';
        return ctx.response.redirect(redirectPath);
    } catch (error) {
        ctx.session.auth = {};
        console.verbose.error(`Failed to login: ${error.message}`);
        return returnJustMessage(ctx, 'Failed to login:', error.message);
    }
};
