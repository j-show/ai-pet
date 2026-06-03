import jshowConfig from 'eslint-config-jshow';

import rootConfig from '../../eslint.config';

export default [...rootConfig, ...jshowConfig.vue];
