const fs = require('fs')

module.exports = () => {
    fs.unlink("moorhen.data", (err) => { if(err) console.log(err) })
    fs.unlink("baby-gru", (err) => { if(err) console.log(err) })
}
