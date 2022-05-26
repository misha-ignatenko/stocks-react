import React, { Component } from 'react';
import { withTracker } from 'meteor/react-meteor-data';
import { NavLink } from 'react-router-dom';

import AccountsUIWrapper from './AccountsUIWrapper.jsx';

class Navigation extends Component {

    constructor(props) {
        super(props);    
    }

    render() {
        const showDataImportsTab = this.props?.showDataImportsTab;
        const activeStyle = ({isActive}) => {
            if (isActive) return {fontWeight: 'bold'};
        };

        return (
            <div>
                <header>
                    <AccountsUIWrapper />
                </header>

                <NavLink to="/" style={activeStyle}>Portfolios</NavLink> |{' '}
                <NavLink to="/stock" style={activeStyle}>Individual Stocks</NavLink> |{' '}
                <NavLink to="/upcomingEarningsReleases" style={activeStyle}>Upcoming Earnings Releases</NavLink> |{' '}
                <NavLink to="/contact" style={activeStyle}>Contact</NavLink> |{' '}
                {showDataImportsTab ? <NavLink to="/dataImports" style={activeStyle}>Data Imports</NavLink> : null}
            </div>
        );
    }
}

export default withTracker((props) => {
    const userID = Meteor.userId();
    const user = Meteor.users.findOne(userID, {fields: {showDataImportsTab: 1}});
    const showDataImportsTab = user?.showDataImportsTab;

    return {showDataImportsTab};
})(Navigation);