Meteor.methods({
    "sendSampleEmail": function() {

        Email.send({
            to: Settings.findOne().serverSettings.ratingsChanges.emailTo,
            from: Settings.findOne().serverSettings.ratingsChanges.emailFrom,
            subject: 'test email',
            text: JSON.stringify({
                timeNow: new Date(),
                text: 'hi'
            })
        });

    }
})