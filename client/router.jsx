import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import { Routes, Route, BrowserRouter } from 'react-router-dom';

import StocksApp from '../client/components/StocksApp.jsx';
import IndividualStock from '../client/components/IndividualStock.jsx';
import DataImportsMain from './components/dataImports/DataImportsMain.jsx';
import { UpcomingEarningsReleases } from './components/UpcomingEarningsReleases.jsx';
import { EarningsAnalysis } from './components/EarningsAnalysis.jsx';
import Contact from './components/Contact.jsx';
import Navigation from './components/Navigation.jsx';
import RatingChanges from './components/Ratings/RatingChanges.jsx';

Meteor.startup(function() {
    let AppRoutes = (
        <div className="container">
        <BrowserRouter>
            <Navigation />

            <Routes>
                <Route path="/portfolios" element={<StocksApp />} />
                <Route path="/" element={<RatingChanges />}/>
                <Route path="/ratingChanges" element={<RatingChanges />}/>
                <Route path="/stock" element={<IndividualStock />} />
                <Route path="/upcomingEarningsReleases" element={<UpcomingEarningsReleases />}/>
                <Route path="/analysis" element={<EarningsAnalysis />}/>
                <Route path="/contact" element={<Contact />}/>
                <Route path="/dataImports" element={<DataImportsMain />}/>
            </Routes>
        </BrowserRouter>
        </div>
    )
    const container = document.getElementById('render-target');
    const root = createRoot(container);
    root.render(AppRoutes);
})