if (Meteor.isClient) {
    Accounts.ui.config({
        passwordSignupFields: "USERNAME_ONLY"
    });

    // Meteor.subscribe("pickLists");
    // Meteor.subscribe("pickListItems");

    Meteor.subscribe("settings");

    //Meteor.startup(function () {
    //    React.render(<App />, document.getElementById("render-target"));
    //});

    StocksReact = {};
    StocksReact.dates = {
        _convert__YYYY_MM_DD__to__MM_slash_DD_slash_YYYY: function(yyyy_mm_dd) {
            var _years = yyyy_mm_dd.substring(0,4);
            var _months = yyyy_mm_dd.substring(5,7);
            var _days = yyyy_mm_dd.substring(8,10);
            return _months + "/" + _days + "/" + _years;
        }
    };
    StocksReact.functions = {
        getRatingScalesHandleFromAvailableRatingChanges: function(optionalRatingChangesArray) {
            var _shortedRatingChanges = optionalRatingChangesArray || RatingChanges.find({}, {fields: {oldRatingId: 1, newRatingId: 1}}).fetch();
            var _uniqOldRatingIds = _.uniq(_.pluck(_shortedRatingChanges, 'oldRatingId'));
            var _uniqNewRatingIds = _.uniq(_.pluck(_shortedRatingChanges, 'newRatingId'));
            var _allUniqRatingIdsForSubscription = _.union(_uniqOldRatingIds, _uniqNewRatingIds);

            return Meteor.subscribe("specificRatingScales", _allUniqRatingIdsForSubscription);
        }
    };

    StocksReact.ui = {
        setDateRangeOptions: function(dateRangeClassName) {
            var _daterangeOptions = {
                autoclose: true,
                todayHighlight: true,
                orientation: "top auto"
            };
            $("." + dateRangeClassName).datepicker(_daterangeOptions);
        },
        getStateForDateRangeChangeEvent: function(event) {
            var _newVal = $(event.target).val();
            var _format = "YYYY-MM-DD";
            var _momentDate = moment(new Date(_newVal).toISOString()).format(_format);
            if (moment(_momentDate).isAfter(moment())) {
                _momentDate = moment(new Date().toISOString()).format(_format);
            }
            var _id = $(event.target).attr('id');
            var _set = {};
            _set[_id] = _momentDate;

            return _set;
        }
    };
}
