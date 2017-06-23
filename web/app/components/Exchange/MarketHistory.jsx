import React from "react";
import {PropTypes} from "react/addons";
import Immutable from "immutable";
import Ps from "perfect-scrollbar";
import utils from "common/utils";
import Translate from "react-translate-component";
import market_utils from "common/market_utils";
import PriceText from "../Utility/PriceText";

class MarketHistory extends React.Component {
    shouldComponentUpdate(nextProps) {
        return (
            !Immutable.is(nextProps.history, this.props.history) ||
            nextProps.baseSymbol !== this.props.baseSymbol ||
            nextProps.quoteSymbol !== this.props.quoteSymbol
        );
    }

    componentDidMount() {
        let historyContainer = React.findDOMNode(this.refs.history);
        Ps.initialize(historyContainer);
    }

    componentDidUpdate() {
        let historyContainer = React.findDOMNode(this.refs.history);
        Ps.update(historyContainer);
    }

    render() {
        let {history, base, quote, baseSymbol, quoteSymbol, flipped} = this.props;
        let historyRows = null;
        if (history.size > 0) {
            let index = 0;
            let keyIndex = -1;
            let flipped = base.get("id").split(".")[2] > quote.get("id").split(".")[2];
            historyRows = this.props.history
            .filter(a => {
                index++;
                return index % 2 === 0;
            })
            .take(50)
            .map(order => {
                keyIndex++;
                let paysAsset, receivesAsset, isAsk = false;
                if (order.pays.asset_id === base.get("id")) {
                    paysAsset = base;
                    receivesAsset = quote;
                    isAsk = true;

                } else {
                    paysAsset = quote;
                    receivesAsset = base;
                }

                let parsed_order = market_utils.parse_order_history(order, paysAsset, receivesAsset, isAsk, flipped);
                return (
                    <tr key={keyIndex}>
                        <td className={parsed_order.className}>
                            <PriceText preFormattedPrice={parsed_order} />
                        </td>
                        <td>{parsed_order.receives}</td>
                        <td>{parsed_order.pays}</td>
                        <td data-tip={new Date(order.time)}>{parsed_order.time}</td>
                    </tr>
                );
            }).toArray();
        }

        return (
            <div className="left-order-book no-padding no-overflow">
                <div className="grid-block shrink left-orderbook-header market-right-padding-only">
                    <table className="table expand order-table text-right market-right-padding">
                        <thead>
                            <tr>
                                <th style={{textAlign: "right"}}><Translate content="exchange.price" /><br/><span className="header-sub-title">{baseSymbol}/{quoteSymbol}</span></th>
                                <th style={{textAlign: "right"}}><Translate content="transfer.amount" /><br/><span className="header-sub-title">({quoteSymbol})</span></th>
                                <th className="show-for-large" style={{textAlign: "right"}}><Translate content="exchange.value" /><br/><span className="header-sub-title">({baseSymbol})</span></th>
                                <th style={{textAlign: "right"}}><Translate content="explorer.block.date" /><br/><span style={{visibility: "hidden"}} className="header-sub-title">({quoteSymbol})</span></th>
                            </tr>
                        </thead>
                    </table>
                </div>
                <div className="table-container grid-content market-right-padding-only" ref="history">
                    <table className="table expand order-table text-right market-right-padding">
                        <tbody>
                        {
                            historyRows
                        }
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}

MarketHistory.defaultProps = {
    history: []
};

MarketHistory.propTypes = {
    history: PropTypes.object.isRequired
};

export default MarketHistory;
