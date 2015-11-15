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
    Meteor.subscribe("stocks");

    //Meteor.startup(function () {
    //    React.render(<App />, document.getElementById("render-target"));
    //});
}
