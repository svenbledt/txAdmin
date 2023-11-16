//Constants
export const refBuckets = [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10, '+Inf'];
const perfLineRegex = /tickTime_(count|sum|bucket)\{name="(svSync|svNetwork|svMain)"(,le="(\d+(\.\d+)?|\+Inf)")?\}\s(\S+)/;


/**
 * Parses the FXServer /perf/ output in the proteus scrape text format
 * @param {string} raw
 */
export const parsePerf = (raw) => {
    if (typeof raw !== 'string') throw new Error('string expected');

    //Vars
    const lines = raw.trim().split('\n');
    const metrics = {
        svSync: {
            buckets: [],
        },
        svNetwork: {
            buckets: [],
        },
        svMain: {
            buckets: [],
        },
    };

    //Parse lines
    for (let i = 0; i < lines.length; i++) {
        const parsed = lines[i].match(perfLineRegex);
        if (parsed == null) continue;
        const regType = parsed[1];
        const thread = parsed[2];
        const bucket = parsed[4];
        const value = parsed[6];

        if (regType == 'count') {
            const count = parseInt(value);
            if (!isNaN(count)) metrics[thread].count = count;
        } else if (regType == 'sum') {
            const sum = parseFloat(value);
            if (!isNaN(sum)) metrics[thread].sum = sum;
        } else if (regType == 'bucket') {
            const bucketIndex = metrics[thread].buckets.length;
            if (bucketIndex === 14 && bucket !== refBuckets[14]) {
                throw new Error(`unexpected bucket ${refBuckets[14]} at index 14 and got ${bucket}`);
            } else if (bucketIndex !== 14 && parseFloat(bucket) !== refBuckets[bucketIndex]) {
                throw new Error(`unexpected bucket ${bucket} at position ${bucketIndex}`);
            }
            metrics[thread].buckets.push(parseInt(value));
        }
    }

    //Check perf validity
    const invalid = Object.values(metrics).some((thread) => {
        return (
            !Number.isInteger(thread.count)
            || !Number.isFinite(thread.sum)
            || thread.buckets.length !== refBuckets.length - 1
        );
    });
    if (invalid.length) throw new Error(`there are ${invalid.length} invalid threads in /perf/ data`);

    return metrics;
};


/**
 * Compares a perf snapshot with the one that came before
 * @param {object} newPerf
 * @param {object} oldPerf
 */
export const diffPerfs = (newPerf, oldPerf = false) => {
    if (oldPerf === false) {
        const zeros = {
            count: 0,
            sum: 0,
            buckets: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        };
        oldPerf = {
            svSync: zeros,
            svNetwork: zeros,
            svMain: zeros,
        };
    }
    return {
        svSync: {
            count: newPerf.svSync.count - oldPerf.svSync.count,
            sum: newPerf.svSync.sum - oldPerf.svSync.sum,
            buckets: newPerf.svSync.buckets.map((bucket, i) => bucket - oldPerf.svSync.buckets[i]),
        },
        svNetwork: {
            count: newPerf.svNetwork.count - oldPerf.svNetwork.count,
            sum: newPerf.svNetwork.sum - oldPerf.svNetwork.sum,
            buckets: newPerf.svNetwork.buckets.map((bucket, i) => bucket - oldPerf.svNetwork.buckets[i]),
        },
        svMain: {
            count: newPerf.svMain.count - oldPerf.svMain.count,
            sum: newPerf.svMain.sum - oldPerf.svMain.sum,
            buckets: newPerf.svMain.buckets.map((bucket, i) => bucket - oldPerf.svMain.buckets[i]),
        },
    };
};


/**
 * Validates a perf thread object validity
 * @param {object} threadData
 */
export const validatePerfThreadData = (threadData) => {
    return (
        threadData
        && typeof threadData == 'object'
        && typeof threadData.count == 'number'
        && typeof threadData.sum == 'number'
        && Array.isArray(threadData.buckets)
        && threadData.buckets.length == 15
        && threadData.buckets.every((b) => typeof b == 'number')
    );
};


/**
 * Returns true if all data inside performance history file is valid
 * @param {array} perfCache
 */
export const validatePerfCacheData = (perfCache) => {
    return perfCache.every((s) => {
        return (
            typeof s.ts == 'number'
            && typeof s.mainTickCounter == 'number'
            && typeof s.clients == 'number'
            && validatePerfThreadData(s.perfSrc.svSync)
            && validatePerfThreadData(s.perfSrc.svNetwork)
            && validatePerfThreadData(s.perfSrc.svMain)
            && validatePerfThreadData(s.perf.svSync)
            && validatePerfThreadData(s.perf.svNetwork)
            && validatePerfThreadData(s.perf.svMain)
        );
    });
};
