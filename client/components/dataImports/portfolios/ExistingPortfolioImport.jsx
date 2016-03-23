ExistingPortfolioImport = React.createClass({

    mixins: [ReactMeteorData],

    getMeteorData() {
        var _data = {};

        var _portfoliosHandle = Meteor.subscribe("portfolios");
        if (_portfoliosHandle.ready()) {
            _data.portfolios = Portfolios.find().fetch()
        }

        return _data;
    },

   render() {

       return (<div className="container">
           existing portfolio import here: {this.props.portfolioId}
           <br/>
           {this.data.portfolios ?
               <div>
                   portfolios list here
               </div> :
               "Loading Portfolios"
           }
       </div>);
   }
});