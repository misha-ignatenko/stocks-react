import React, { useState, useEffect } from 'react';
import { useTracker } from 'meteor/react-meteor-data';
import { NavLink } from 'react-router-dom';
import { Meteor } from 'meteor/meteor';
import { Permissions } from '../../lib/permissions';

import AccountsUIWrapper from './AccountsUIWrapper.jsx';

function Navigation() {
    const [isPremium, setIsPremium] = useState(false);

    const { showDataImportsTab } = useTracker(() => {
        const user = Meteor.user({ fields: { showDataImportsTab: 1 } });
        return {
            showDataImportsTab: user?.showDataImportsTab
        };
    }, []);

    useEffect(() => {
        Permissions.isPremium().then(result => {
            setIsPremium(result);
        });
    }, []);

    const activeStyle = ({isActive}) => {
        if (isActive) return {fontWeight: 'bold'};
    };

    return (
        <div>
            <header>
                <AccountsUIWrapper />
            </header>

            <NavLink to="/ratingChanges" style={activeStyle}>Rating Changes</NavLink> |{' '}
            <NavLink to="/stock" style={activeStyle}>Individual Stocks</NavLink> |{' '}
            <NavLink to="/upcomingEarningsReleases" style={activeStyle}>Upcoming Earnings Releases</NavLink> |{' '}
            {isPremium ? <span>
                <NavLink to="/analysis" style={activeStyle}>Analysis</NavLink> |{' '}
            </span> : null}
            <NavLink to="/contact" style={activeStyle}>Contact</NavLink> |{' '}
            {showDataImportsTab ? <NavLink to="/dataImports" style={activeStyle}>Data Imports</NavLink> : null}
        </div>
    );
}

export default Navigation;
