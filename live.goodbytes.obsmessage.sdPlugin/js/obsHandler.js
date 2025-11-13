/**
 * @property {string} ipAddress
 * @property {number} port
 * @property {string} password
 * @property {OBSWebSocket} obs
 * @property {boolean} connected
 * @property {Promise<*> | null} connectionPromise
 */
class ObsHandler {

    /**
     * @param [jsonObj]
     */
    constructor(jsonObj) {
        this.obs = new OBSWebSocket();
        this.connected = false;
        this.connectionPromise = null;

        // You must add this handler to avoid uncaught exceptions.
        this.obs.on('error', err => {
            console.error(`OBS Websocket: error.`, err);
        });

        this.obs.on('ConnectionOpened', data => {
            console.log(`OBS Websocket: Connection opening...`, data);
            action.setObsStatus(); // action.setState();
        });
        this.obs.on('ConnectionClosed', data => {
            this.connected = false;
            this.connectionPromise = null;
            console.log(`OBS Websocket: Connection terminated.`, data);
            action.setObsStatus(); // action.setState();
        });
        this.obs.on('AuthenticationSuccess', data => {
            console.log(`OBS Websocket: Success! We're connected & authenticated.`, data);
            action.setObsStatus(); // action.setState();
        });
        this.obs.on('AuthenticationFailure', data => {
            this.connected = false;
            this.connectionPromise = null;
            console.error(`OBS Websocket: Authentication FAILED.`, data);
            action.setObsStatus(); // action.setState();
        });
        this.obs.on('Identified', data => {
            console.log(`OBS Websocket: Identified! We're connected without authentication.`, data);
            action.setObsStatus(); // action.setState();
        });
    }

    /**
     * @param {Object} [settings]
     * @param {string} [settings.ipAddress]
     * @param {number} [settings.port]
     * @param {string} [settings.password]
     * @return {{password: string, port: number, ipAddress: string}}
     */
    settings(settings) {
        if(settings !== null && settings !== undefined)
        {
            this.ipAddress = settings['ipAddress'] || '127.0.0.1';
            this.port = settings['port'] || 4455;
            this.password = settings['password'] || '';
        }
        return {
            'ipAddress': this.ipAddress,
            'port': this.port,
            'password': this.password
        };
    }

    /**
     * @return {{password: string, port: number, ipAddress: string}}
     */
    defaultSettings() {
        return {
            'ipAddress': '127.0.0.1',
            'port': 4455,
            'password': ''
        };
    }

    /**
     * Checks to see if we have SOMETHING entered for the OBS Websockets IP and Port. Password being blank is fine.
     * @return {boolean}
     */
    isValidOBSSettings() {
        return (this.ipAddress !== '' && this.port >= 0 && this.port <= 65535);
    }

    /**
     * @return {string}
     */
    getOBSAddress() {
        return 'ws://' + this.ipAddress + ':' + this.port.toString();
    }

    /**
     * @param {boolean} [reconnect = false] Force a reconnect if we are already connected?
     * @return {Promise<*>}
     */
    connect(reconnect = false) {
        if (this.connected && !reconnect) {
            return Promise.resolve();
        }
        if (this.connectionPromise && !reconnect) {
            return this.connectionPromise;
        }

        if (reconnect) {
            try {
                this.obs.disconnect();
            } catch (e) {
                console.warn(`OBS Websocket: error on forced disconnect before reconnect:`, e);
            }
            this.connected = false;
            this.connectionPromise = null;
        }

        const address = this.getOBSAddress();
        const password = this.password || undefined;

        console.log(`OBS Websocket: connect() ->`, address);

        const promise = this.obs.connect(address, password)
            .then(data => {
                this.connected = true;
                this.connectionPromise = null;
                return data;
            })
            .catch(err => {
                this.connected = false;
                this.connectionPromise = null;
                throw err;
            });

        this.connectionPromise = promise;
        return promise;
    }

    /**
     *
     */
    disconnect() {
        if (this.connected || this.connectionPromise) {
            try {
                this.obs.disconnect();
            } catch (err) {
                console.warn('OBS Websocket: error on disconnect()', err)
            }

        }
        this.connected = false;
        this.connectionPromise = null;
    }

    /**
     * @param {string} message
     * @param {string} [data]
     * @return {Promise<*|Promise|void>}
     */
    async send(message, data) {
        if(!this.connected) {
            await this.connect();
        }
        return this.obs.call('BroadcastCustomEvent', {
            'eventData': {
                'realm': 'kruiz-control',
                'data': {
                    'message': message,
                    'data': (data || '')
                }
            }
        });
    }

}