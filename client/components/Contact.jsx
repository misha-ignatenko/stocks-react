import React, { Component } from 'react';
import { withTracker } from 'meteor/react-meteor-data';

class Contact extends Component {

    constructor(props) {
        super(props);

        this.state = {
        };
    }

    render() {

        return (
            <div className="container">
                <br/>
                <h5>
                    For more info on analyst ratings & earnings releases, <a href = "mailto: mign628@gmail.com">Send Us An Email</a>
                </h5>
            </div>
        )
    }
}

export default withTracker(() => {
    const user = Meteor.user();
    return {
        currentUser: user,
    }
})(Contact);
