import cron from "node-cron";
import _ from "underscore";
import moment from "moment-timezone";
import { Meteor } from "meteor/meteor";
import { Utils } from "../lib/utils";

const TZ = { timezone: "America/New_York" };

Meteor.startup(function () {
    // skip data pull if dev env
    if (Meteor.isDevelopment) return;

    // 2am & 9am Eastern
    cron.schedule("0 2,9 * * *", () => {
        console.log("Running: earnings releases");
        Meteor.callAsync("importEarningsReleases").catch((error) => {
            console.error("Error in earnings releases cron:", error);
        });
    }, TZ);

    // 2:05am-2:09am & 9:05am-9:09am Eastern (nasdaq, +0 to +4 business days)
    [0, 1, 2, 3, 4].forEach((offset) => {
        cron.schedule(`${5 + offset} 2,9 * * *`, () => {
            const date = Utils.businessAdd(moment().format(Utils.dateFormat), offset);
            console.log(`Running: earnings releases (nasdaq, +${offset}bd, ${date})`);
            Meteor.callAsync("importEarningsReleasesFromNasdaq", { date }).catch((error) => {
                console.error(`Error in earnings releases (nasdaq, +${offset}bd) cron:`, error);
            });
        }, TZ);
    });

    const baseOptions = {
        advancePurchaseDays: 1,
        saleDelayInDays: 2,
        saleDelayInDaysFinal: 10,
        ratingChangesLookbackInDays: 500,
        isForecast: true,
        includeHistory: true,
        bizDaysLookbackForHistory: 1000,
        emailResults: true,
    };

    // every weekday at 9:45am Eastern
    cron.schedule("45 9 * * 1-5", () => {
        console.log("Running: 1st job");
        Meteor.callAsync("getEarningsAnalysis", {
            startDate: Utils.businessAdd(Utils.todaysDate(), 1),
            endDate: Utils.businessAdd(Utils.todaysDate(), 2),
            ...baseOptions,
        }).catch((error) => {
            console.error("Error in 1st job:", error);
        });
    }, TZ);

    // every weekday at 10am Eastern
    cron.schedule("0 10 * * 1-5", () => {
        console.log("Running: 2nd job");
        Meteor.callAsync("getEarningsAnalysis", {
            startDate: Utils.businessAdd(Utils.todaysDate(), -1),
            endDate: Utils.todaysDate(),
            ...baseOptions,
        }).catch((error) => {
            console.error("Error in 2nd job:", error);
        });
    }, TZ);

    console.log("Cron jobs initialized");
});
