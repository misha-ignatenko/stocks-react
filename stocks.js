EarningsReleases = new Meteor.Collection("earningsReleases");
RatingChanges = new Meteor.Collection("ratingChanges");
ResearchCompanies = new Meteor.Collection("researchCompanies");
StockPrices = new Meteor.Collection("stockPrices");
PickLists = new Meteor.Collection("pickLists");
GradingScales = new Meteor.Collection("gradingScales");
PickListItems = new Meteor.Collection("pickListItems");

if (Meteor.isClient) {
    Accounts.ui.config({
        passwordSignupFields: "USERNAME_ONLY"
    });

    Meteor.subscribe("earningsReleases");
    Meteor.subscribe("ratingChanges");
    Meteor.subscribe("researchCompanies");
    Meteor.subscribe("stockPrices");
    Meteor.subscribe("pickLists");
    Meteor.subscribe("gradingScales");
    Meteor.subscribe("pickListItems");

    //Meteor.startup(function () {
    //    React.render(<App />, document.getElementById("render-target"));
    //});
}

if (Meteor.isServer) {
    Meteor.publish("earningsReleases", function () {
        return EarningsReleases.find();
    });
    Meteor.publish("ratingChanges", function () {
        return RatingChanges.find();
    });
    Meteor.publish("researchCompanies", function () {
        return ResearchCompanies.find();
    });
    Meteor.publish("stockPrices", function () {
        return StockPrices.find();
    });
    Meteor.publish("gradingScales", function () {
        return GradingScales.find();
    });
    Meteor.publish("pickLists", function () {
        return PickLists.find();
    });

    Meteor.publish("pickListItems", function () {
        return PickListItems.find();
    });
}

Meteor.methods({
    addPickList: function(pickListName, pickListDate, stocksList) {
        // Make sure the user is logged in before inserting a task
        if (! Meteor.userId()) {
            throw new Meteor.Error("not-authorized");
        }

        PickLists.insert({
            listName: pickListName,
            pickListDate: pickListDate,
            stocksList: stocksList,
            addedBy: Meteor.userId(),
            addedByUsername: Meteor.user().username
        });
    },
    getFullQuote: function (symbol) {
        var _fullQuote = YahooFinance.snapshot({symbols: [symbol]});
        return _fullQuote;
    },
    getLatestAskPrice: function (symbol) {
        var _latestPriceQuote = YahooFinance.snapshot({symbols: [symbol], fields: ['s', 'n', 'd1', 'l1', 'y', 'r']});
        return _latestPriceQuote;
    },
    getCompanyName: function (symbol) {
        var _quote = YahooFinance.snapshot({symbols: [symbol], fields: ['n']});
        return _quote[symbol].name;
    }
});