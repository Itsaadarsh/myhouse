"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorkers = void 0;
const mediasoup_1 = require("mediasoup");
const config_1 = __importDefault(require("../config"));
const createWorkers = (workers) => __awaiter(void 0, void 0, void 0, function* () {
    let { numWorkers } = config_1.default.mediasoup;
    for (let i = 0; i < numWorkers; i++) {
        const worker = yield mediasoup_1.createWorker({
            logLevel: config_1.default.mediasoup.worker.logLevel,
            logTags: config_1.default.mediasoup.worker.logTags,
            rtcMinPort: config_1.default.mediasoup.worker.rtcMinPort,
            rtcMaxPort: config_1.default.mediasoup.worker.rtcMaxPort,
        });
        worker.on('died', () => {
            console.error('MS worker died, exiting..', worker.pid);
            setTimeout(() => process.exit(1), 2000);
        });
        workers.push(worker);
    }
});
exports.createWorkers = createWorkers;
//# sourceMappingURL=createWorker.js.map