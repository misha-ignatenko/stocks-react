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
    addStockToPickList: function(pickListId, stockId, dateAdded) {
        var _alreadyExistingPickListItem = PickListItems.findOne({
            pickListId: pickListId,
            stockId: stockId,
            dateAdded: dateAdded
        });
        if (_alreadyExistingPickListItem) {
            console.log("attempt to enter duplicate pick list item prevented. item id: ", _alreadyExistingPickListItem._id, ", stock symbol: ", _alreadyExistingPickListItem.stockId);
        } else {
            PickListItems.insert({
                pickListId: pickListId,
                stockId: stockId,
                dateAdded: dateAdded
            });
        }
    },
    removeStockFromPickList: function(pickListId, stockId) {
        //TODO check for duplicated dateRemoved
    },
    removePickList: function(pickListId) {
        PickLists.remove(pickListId);
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
    },
    getHistoricalData: function(symbol, startDate, endDate) {
        //TODO first need to check if historical stock data exists in stockPrices collection.
        //TODO if data is not there, then select which data is missing: startDateInCollection minus startDate and endDate minus endDateInCollection
        //get data from yahoo finance for those two time intervals
        //if data is already in
        //update the existingStartDate and existingEndDate after pulling new data
        var _stockPricesObj = StockPrices.findOne({symbol: symbol});
        if (_stockPricesObj && _stockPricesObj.historicalData && _stockPricesObj.existingStartDate && _stockPricesObj.existingEndDate) {
            //this means there IS previously recorded data in the StockPrices object for the selected stock symbol.
        } else {
            //this means that there is no data at all in the StockPrices array so we need to just pull it from Yahoo Finance
            //AND update existingStartDate and existingEndDate to startDate and endDate correspondingly.
            console.log("initializing historical data because previous data doesn't exist.");
            console.log("sample date: ", new Date());
            console.log("stock symbol: ", symbol);
            console.log("start date: ", startDate);
            console.log("end date: ", endDate);
        }
    }
});