import React, { Component } from 'react';
import { render } from 'react-dom';
import { Router, Route, Switch } from 'react-router';
import history from 'history';

import StocksApp from '../client/components/StocksApp.jsx';
import IndividualStock from '../client/components/IndividualStock.jsx';
import UpDownGradesJSONDataImport from '../client/components/dataImports/UpDownGradesJSONDataImport.jsx';
import EarningsReleasesJSONDataImport from '../client/components/dataImports/EarningsReleasesJSONDataImport.jsx';
import ImportRatingScales from '../client/components/dataImports/ImportRatingScales.jsx';
import Blob from '../client/components/Blob.jsx';

const browserHistory = history.createBrowserHistory();

Meteor.startup(function() {
    let AppRoutes = (
        <div className="container">
        <Router history={browserHistory}>
            <Switch>
                <Route exact path="/" component={StocksApp} />
                <Route exact path="/stock" component={IndividualStock} />
                <Route exact path="/dataimport/updowngrades" component={UpDownGradesJSONDataImport} />
                <Route exact path="/dataimport/earningsreleases" component={EarningsReleasesJSONDataImport} />
                <Route exact path="/dataimport/ratingscales" component={ImportRatingScales} />
                <Route exact path="/blob" component={Blob} />
            </Switch>
        </Router>
        </div>
    )
    render(AppRoutes, document.getElementById("render-target"))
})