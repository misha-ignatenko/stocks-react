Meteor.methods({
    "sendSampleEmail": function() {

        Email.send({
            to: ServerUtils.getEmailTo(),
            from: ServerUtils.getEmailFrom(),
            subject: 'test email',
            text: JSON.stringify({
                timeNow: new Date(),
                text: 'hi'
            })
        });

    }
})