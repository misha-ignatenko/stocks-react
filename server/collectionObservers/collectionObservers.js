Meteor.startup(function() {
    StockPrices.find().observe({
        added: function(document) {
            console.log("new stock prices object added: ", document.symbol);
        },
        removed: function(oldDocument) {
            console.log("new stock prices object REMOVED: ", oldDocument.symbol);
        }
    })
});