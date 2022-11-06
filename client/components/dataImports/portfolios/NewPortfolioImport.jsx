import React, { Component } from 'react';

export default class NewPortfolioImport extends Component {
    constructor(props) {
        super(props);

        this.state = {
            private: true
        };

        this.toggle = this.toggle.bind(this);
    }

    toggle(event) {
        this.setState({
            private: !this.state.private
        });
    }

    createNewPortfolio(event) {
        var _that = this;
        var _obj = {
            name: ReactDOM.findDOMNode(this.refs.newPortfolioName).value.trim(),
            private: this.state.private,
            firmName: ReactDOM.findDOMNode(this.refs.firmName).value.trim()
        };
        Meteor.call('importData', _obj, 'portfolio', function(error, result) {
            if (!error && result && result.newPortfolioId) {
                _that.props.onNewPortfolioCreate(result.newPortfolioId);
            } else if (error) {
                $.bootstrapGrowl(error.error, {
                    type: 'danger',
                    align: 'center',
                    width: 400,
                    delay: 10000000
                });
            }
        });
    }

    render() {
        let _b = "btn btn-light";
        let _ab = "btn btn-light active";

        return (<div className="container">
            <br/>
            <input type="text" ref="newPortfolioName" placeholder="Name" /><div className="btn-group" role="group" aria-label="...">
            <button type="button" className={!this.state.private ? _ab : _b} onClick={this.toggle}>Public</button>
            <button type="button" className={this.state.private ? _ab : _b} onClick={this.toggle}>Private</button></div>
            <br/>
            <input type="text" ref="firmName" placeholder="Firm name (if known)" />
            <br/>
            <button className={_b} onClick={this.createNewPortfolio}>Submit</button>
        </div>);
    }
}