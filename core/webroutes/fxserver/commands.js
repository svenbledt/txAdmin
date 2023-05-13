const modulename = 'WebServer:FXServerCommands';
import xssInstancer from '@core/extras/xss.js';
import consoleFactory from '@extras/console';
const console = consoleFactory(modulename);
const xss = xssInstancer();

//Helper functions
const escape = (x) => {return x.replace(/"/g, '\uff02');};
const formatCommand = (cmd, ...params) => {
    return `${cmd} "` + [...params].map(escape).join('" "') + '"';
};


/**
 * Handle all the server commands
 * @param {object} ctx
 */
export default async function FXServerCommands(ctx) {
    if (
        typeof ctx.request.body.action === 'undefined'
        || typeof ctx.request.body.parameter === 'undefined'
    ) {
        return sendAlertOutput(ctx, 'Invalid request!');
    }
    const action = ctx.request.body.action;
    const parameter = ctx.request.body.parameter;

    //Ignore commands when the server is offline
    if (globals.fxRunner.fxChild === null) {
        return ctx.send({
            type: 'danger',
            message: '<b>Cannot execute this action with the server offline.</b>',
        });
    }

    //Block starting/restarting the 'runcode' resource
    const unsafeActions = ['restart_res', 'start_res', 'ensure_res'];
    if (unsafeActions.includes(action) && parameter.includes('runcode')) {
        return ctx.send({
            type: 'danger',
            message: '<b>Error:</b> The resource "runcode" might be unsafe. <br> If you know what you are doing, run it via the Live Console.',
        });
    }


    //==============================================
    //DEBUG: Only available in the /advanced page
    if (action == 'profile_monitor') {
        if (!ensurePermission(ctx, 'all_permissions')) return false;
        ctx.utils.logAction('Profiling txAdmin instance.');

        const profSeconds = 5;
        const savePath = `${globals.info.serverProfilePath}/data/txProfile.bin`;
        ExecuteCommand('profiler record start');
        setTimeout(async () => {
            ExecuteCommand('profiler record stop');
            setTimeout(async () => {
                ExecuteCommand(`profiler save "${escape(savePath)}"`);
                setTimeout(async () => {
                    console.ok(`Profile saved to: ${savePath}`);
                    globals.fxRunner.srvCmd(`profiler view "${escape(savePath)}"`);
                }, 150);
            }, 150);
        }, profSeconds * 1000);
        return sendAlertOutput(ctx, 'Check your live console in a few seconds.');

    //==============================================
    } else if (action == 'admin_broadcast') {
        if (!ensurePermission(ctx, 'players.message')) return false;
        const message = (parameter ?? '').trim();

        // Dispatch `txAdmin:events:announcement`
        const cmdOk = globals.fxRunner.sendEvent('announcement', {
            message,
            author: ctx.session.auth.username,
        });
        ctx.utils.logAction(`Sending announcement: ${parameter}`);

        // Sending discord announcement
        globals.discordBot.sendAnnouncement({
            type: 'info',
            title: {
                key: 'nui_menu.misc.announcement_title',
                data: {author: ctx.session.auth.username}
            },
            description: message
        });

        return ctx.send({
            type: cmdOk ? 'success' : 'danger',
            message: 'Announcement sent!',
        });

    //==============================================
    } else if (action == 'kick_all') {
        if (!ensurePermission(ctx, 'players.kick')) return false;
        let cmd;
        if (parameter.length) {
            cmd = formatCommand('txaKickAll', parameter);
        } else {
            cmd = 'txaKickAll "txAdmin Web Panel"';
        }
        ctx.utils.logCommand(cmd);
        let toResp = await globals.fxRunner.srvCmdBuffer(cmd);
        return sendAlertOutput(ctx, toResp);

    //==============================================
    } else if (action == 'restart_res') {
        if (!ensurePermission(ctx, 'commands.resources')) return false;
        let cmd = formatCommand('restart', parameter);
        ctx.utils.logCommand(cmd);
        let toResp = await globals.fxRunner.srvCmdBuffer(cmd);
        return sendAlertOutput(ctx, toResp);

    //==============================================
    } else if (action == 'start_res') {
        if (!ensurePermission(ctx, 'commands.resources')) return false;
        let cmd = formatCommand('start', parameter);
        ctx.utils.logCommand(cmd);
        let toResp = await globals.fxRunner.srvCmdBuffer(cmd);
        return sendAlertOutput(ctx, toResp);

    //==============================================
    } else if (action == 'ensure_res') {
        if (!ensurePermission(ctx, 'commands.resources')) return false;
        let cmd = formatCommand('ensure', parameter);
        ctx.utils.logCommand(cmd);
        let toResp = await globals.fxRunner.srvCmdBuffer(cmd);
        return sendAlertOutput(ctx, toResp);

    //==============================================
    } else if (action == 'stop_res') {
        if (!ensurePermission(ctx, 'commands.resources')) return false;
        let cmd = formatCommand('stop', parameter);
        ctx.utils.logCommand(cmd);
        let toResp = await globals.fxRunner.srvCmdBuffer(cmd);
        return sendAlertOutput(ctx, toResp);

    //==============================================
    } else if (action == 'refresh_res') {
        if (!ensurePermission(ctx, 'commands.resources')) return false;
        let cmd = 'refresh';
        ctx.utils.logCommand(cmd);
        let toResp = await globals.fxRunner.srvCmdBuffer(cmd);
        return sendAlertOutput(ctx, toResp);

    //==============================================
    } else if (action == 'check_txaclient') {
        let cmd = 'txaPing';
        ctx.utils.logCommand(cmd);
        let toResp = await globals.fxRunner.srvCmdBuffer(cmd, 512);
        if (toResp.includes('Pong!')) {
            return ctx.send({
                type: 'success',
                message: `<b>txAdminClient is running!</b><br> <pre>${xss(toResp)}</pre>`,
            });
        } else {
            return ctx.send({
                type: 'danger',
                message: `<b>txAdminClient is not running!</b><br> <pre>${xss(toResp)}</pre>`,
            });
        }

    //==============================================
    } else {
        ctx.utils.logCommand('Unknown action!');
        return ctx.send({
            type: 'danger',
            message: 'Unknown Action.',
        });
    }
};



//================================================================
/**
 * Wrapper function to send the output to be shown inside an alert
 * @param {object} ctx
 * @param {string} msg
 */
async function sendAlertOutput(ctx, toResp) {
    toResp = (toResp.length) ? xss(toResp) : 'no output';
    return ctx.send({
        type: 'warning',
        message: `<b>Output:</b><br> <pre>${toResp}</pre>`,
    });
}


//================================================================
/**
 * Wrapper function to check permission and give output if denied
 * @param {object} ctx
 * @param {string} perm
 */
function ensurePermission(ctx, perm) {
    if (ctx.utils.testPermission(perm, modulename)) {
        return true;
    } else {
        ctx.send({
            type: 'danger',
            message: 'You don\'t have permission to execute this action.',
        });
        return false;
    }
}
