const {
    Router,
    Route,
    Redirect
    } = ReactRouter;
const history = ReactRouter
    .history
    .useQueries(ReactRouter.history.createHistory)()
Meteor.startup(function() {
    let AppRoutes = (
        <Router history={history}>
            <Route component={App}>
                <Router component={StocksApp} path="/" />
                <Router component={IndividualStock} path="stock" />
                <Router component={UpDownGradesJSONDataImport} path="dataimport/updowngrades"/>
                <Router component={EarningsReleasesJSONDataImport} path="dataimport/earningsreleases"/>
                <Router component={ImportRatingScales} path="dataimport/ratingscales"/>
                <Router component={Blob} path="blob"/>
                <Router component={CorrelationOne} path="correlation-one"/>
            </Route>
        </Router>
    )
    ReactDOM.render(AppRoutes, document.getElementById("render-target"))
})