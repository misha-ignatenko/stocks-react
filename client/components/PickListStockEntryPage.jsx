import { Component } from 'react';

class PickListStockEntryPage extends Component {
    propTypes: {
        pickListId: React.PropTypes.string.isRequired
    }
    getInitialState() {
        return {
            datePortfolioItemAdded: null
        };
    }

    addStockToPickList(event) {
        event.preventDefault();
        var _symbol = this.refs.addStockToPickListTextInput.value.trim();
        var _newDateAdded = this.state.datePortfolioItemAdded;
        var _portfolioId = this.props.pickListId;
        var _that = this;
        if (_symbol && _newDateAdded) {
            Meteor.call("addStockToPickList", _portfolioId, _symbol, _newDateAdded, function(error, result) {
                if (!error) {
                    _that.refs.addStockToPickListTextInput.value = "";
                    _that.setState({
                        datePortfolioItemAdded: null
                    })
                    _that.refs.datePortfolioItemAdded.value = "";
                }
            });
        }
    }
    setDatepickerOptions() {
        let _datepickerOptions = {
            autoclose: true,
            todayHighlight: true,
            orientation: "top auto"
        };
        $('#datePortfolioItemAdded').datepicker(_datepickerOptions);
        var _that = this;

        $('.datepickerInput').on('change', function() {
            let _newVal = $(this).val();
            let _momentDate = moment(new Date(_newVal).toISOString()).format("YYYY-MM-DD");
            _that.setState({
                datePortfolioItemAdded: _momentDate
            });
        });
    }

    render() {
        return (
            <div className="pickListEntryPage">
                <input
                    type="text"
                    ref="addStockToPickListTextInput"
                    placeholder="Type to add new stock to selected portfolio" />

                <span className="datepickers" ref={this.setDatepickerOptions}>
                    <input className="datepickerInput" id="datePortfolioItemAdded" ref="datePortfolioItemAdded"/>
                </span><button onClick={this.addStockToPickList}>add to portfolio</button>
                {this.state.datePortfolioItemAdded}
            </div>
        );
    }
}