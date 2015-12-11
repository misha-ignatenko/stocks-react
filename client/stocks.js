if (Meteor.isClient) {
    Accounts.ui.config({
        passwordSignupFields: "USERNAME_ONLY"
    });

    Meteor.subscribe("earningsReleases");
    Meteor.subscribe("researchCompanies");
    Meteor.subscribe("pickLists");
    Meteor.subscribe("ratingScales");
    Meteor.subscribe("pickListItems");

    //Meteor.startup(function () {
    //    React.render(<App />, document.getElementById("render-target"));
    //});
}
