import React, { Component } from 'react';
import { render } from 'react-dom';
import { Routes, Route, BrowserRouter } from 'react-router-dom';

import StocksApp from '../client/components/StocksApp.jsx';
import IndividualStock from '../client/components/IndividualStock.jsx';
import DataImportsMain from './components/dataImports/DataImportsMain.jsx';
import UpcomingEarningsReleases from './components/UpcomingEarningsReleases.jsx';
import Contact from './components/Contact.jsx';
import Navigation from './components/Navigation.jsx';

Meteor.startup(function() {
    let AppRoutes = (
        <div className="container">
        <BrowserRouter>
            <Navigation />            

            <Routes>
                <Route path="/" element={<StocksApp />} />
                <Route path="/stock" element={<IndividualStock />} />
                <Route path="/upcomingEarningsReleases" element={<UpcomingEarningsReleases />}/>
                <Route path="/contact" element={<Contact />}/>
                <Route path="/dataImports" element={<DataImportsMain />}/>
            </Routes>
        </BrowserRouter>
        </div>
    )
    render(AppRoutes, document.getElementById("render-target"))
})