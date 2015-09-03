PickListItem = React.createClass({

    propTypes: {
        pickListItem: React.PropTypes.object.isRequired,
        showPickListItem: React.PropTypes.bool.isRequired
    },

    render() {
        const pickListClassName = "pickListItem";

        return (
            <div className={pickListClassName}>

                { this.props.showPickListItem ? (
                    <li>
                        <span className="text">
                            <strong>{this.props.pickListItem.stockSymbol}</strong>
                        </span>

                        //TODO: ADD CHARTS HERE
                        
                    </li>
                ) : ''}

            </div>
        );
    }
});