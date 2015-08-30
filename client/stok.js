Template.pick_list.onCreated(function () {
    this.subscribe("allPickLists");
    this.subscribe("allPickListItems");
});

Template.pick_list.helpers({
    pickLists: function () {
        return PickLists.find();
    },
    lastUpdatedFormatted: function () {
        var _notFormatted = this.lastUpdated;
        return moment(_notFormatted).format("YYYY-MM-DD h:m:s a");
    }
});

Template.pick_list.events({
    "click .updatePickListPrices": function () {
        var _allPicklists = PickLists.find().fetch();
        _allPicklists.forEach(function (pickList) {
            Meteor.call('getLatestAskPrice', pickList.symbol, function (err, result) {
                var _quote = result;
                console.log("_quote is: ", _quote);
                var _symbol = pickList.symbol;
                var _ask = _quote[_symbol].ask;
                PickLists.update({_id: pickList._id}, {$set: {ask: _ask, lastUpdated: new Date()}});
            });
        });
    }
});