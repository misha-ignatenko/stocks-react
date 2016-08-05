Meteor.methods({
    "sendSampleEmail": function() {

        Email.send({
            to: Settings.findOne().serverSettings.ratingsChanges.emailTo,
            from: Settings.findOne().serverSettings.ratingsChanges.emailFrom,
            subject: 'hola',
            text: 'hii'
        });

    }
})