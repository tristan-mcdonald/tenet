/*
    polyfill to allow use of replace method on a classList in internet explorer
*/
export default function () {
    if (!("replace" in document.createElement("_").classList)) {
        DOMTokenList.prototype.replace = function (token, replacementToken) {
            let tokens = this.toString().split(" ");
            const index  = tokens.indexOf(token + "");
            if (~index) {
                tokens = tokens.slice(index);
                this.remove.apply(this, tokens);
                this.add(replacementToken);
                this.add.apply(this, tokens.slice(1));
            }
        };
    }
}
