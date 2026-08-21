/**
 * Plugin nội bộ: tám rule ép bất biến của repo, và một bộ luật gộp sẵn.
 *
 * `configs.project` là thứ `.eslintrc.cjs` extends — xem `configs/project.js`.
 * Rule vẫn export riêng lẻ để test dùng `RuleTester` gọi thẳng được.
 */
module.exports = {
  rules: {
    'no-raw-color': require('./no-raw-color.js'),
    'no-raw-number': require('./no-raw-number.js'),
    'no-raw-duration': require('./no-raw-duration.js'),
    'no-direct-set': require('./no-direct-set.js'),
    'no-draft-write-outside-commands': require('./no-draft-write-outside-commands.js'),
    'no-fetch-outside-http': require('./no-fetch-outside-http.js'),
    'no-framer-outside-motion': require('./no-framer-outside-motion.js'),
    'no-data-layer-in-view': require('./no-data-layer-in-view.js')
  },
  configs: {
    project: require('./configs/project.js')
  }
};
