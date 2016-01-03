Package.describe({
    name: 'ign-regression',
    version: '0.0.1',
    // Brief, one-line summary of the package.
    summary: '',
    // URL to the Git repository containing the source code for this package.
    git: '',
    // By default, Meteor will default to using README.md for documentation.
    // To avoid submitting documentation, set this field to null.
    documentation: ''
});

Package.onUse(function (api) {
    var client = ["client"];
    var server = ["server"];
    var serverAndClient = ["server", "client"];

    api.versionsFrom('1.2.1');

    api.use(["ecmascript", "momentjs:moment", "underscore"], client);

    api.addFiles('client/ign-regr.js', client);

    api.export("IgnRegression", client);
});
