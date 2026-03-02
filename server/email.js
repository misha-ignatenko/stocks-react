import { Meteor } from "meteor/meteor";
import { ServerUtils } from "./utils";

const MAIL_URL = process.env.MAIL_URL;
const mailUrlSplit = MAIL_URL.split(":");

const nodemailer = require("nodemailer");
let transporter = nodemailer.createTransport({
    host: mailUrlSplit[2].split("@")[1],
    port: parseInt(mailUrlSplit[3]),
    secure: false,
    auth: {
        user: mailUrlSplit[1].replace("//", ""),
        pass: mailUrlSplit[2].split("@")[0],
    },
});

const send = async (params) => {
    const to = await ServerUtils.getEmailTo();
    params.to = to;
    params.replyTo = to;
    if (!params.from) {
        params.from = await ServerUtils.getEmailFrom();
    }

    console.log("inside send email", params.subject);
    transporter
        .sendMail(params)
        .then((info) => {
            console.log("email sent", info);
        })
        .catch((error) => {
            console.log("error", error);
        });
};

export const Email = {
    send,
};

Meteor.methods({
    sendSampleEmail: async function () {
        await Email.send({
            subject: "test email",
            text: JSON.stringify({
                timeNow: new Date(),
                text: "hi",
            }),
        });
    },
});
