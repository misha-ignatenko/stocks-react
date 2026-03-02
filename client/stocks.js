import "bootstrap/dist/css/bootstrap.min.css";
import { Meteor } from "meteor/meteor";
import moment from "moment-timezone";
import _ from "underscore";

Meteor.subscribe("settings");

// Global utilities (consider moving to a proper module later)
window.StocksReact = {
    dates: {
        _convert__YYYY_MM_DD__to__MM_slash_DD_slash_YYYY: function (
            yyyy_mm_dd,
        ) {
            const years = yyyy_mm_dd.substring(0, 4);
            const months = yyyy_mm_dd.substring(5, 7);
            const days = yyyy_mm_dd.substring(8, 10);
            return `${months}/${days}/${years}`;
        },
    },

    functions: {
        getRatingScalesHandleFromAvailableRatingChanges: function (
            ratingChanges,
        ) {
            const uniqOldRatingIds = _.uniq(
                _.pluck(ratingChanges, "oldRatingId"),
            );
            const uniqNewRatingIds = _.uniq(
                _.pluck(ratingChanges, "newRatingId"),
            );
            const allUniqRatingIdsForSubscription = _.union(
                uniqOldRatingIds,
                uniqNewRatingIds,
            );

            return Meteor.subscribe(
                "specificRatingScales",
                allUniqRatingIdsForSubscription,
            );
        },
    },

    ui: {
        // Note: setDateRangeOptions is removed since you're using react-datepicker now
        // If you still need it, use react-datepicker props instead

        getStateForDateRangeChangeEvent: function (
            event,
            optionalDate = false,
        ) {
            const format = Utils.dateFormat;
            let newVal;

            if (optionalDate) {
                // Called from DatePicker with date object
                newVal = optionalDate;
            } else {
                // Legacy support - shouldn't be needed with controlled inputs
                console.warn(
                    "getStateForDateRangeChangeEvent called without optionalDate",
                );
                return null;
            }

            let momentDate = moment(new Date(newVal).toISOString()).format(
                format,
            );

            // Don't allow future dates
            if (moment(momentDate).isAfter(moment())) {
                momentDate = moment(new Date().toISOString()).format(format);
            }

            return momentDate;
        },
    },
};
