// Global services registry: single source of truth for all service instances.
// This is the only file that calls new on any service class.
// No business logic, no side-effects — only instantiation.

import { DatabaseService } from "../services/DatabaseService";
import { HttpServerService } from "../services/HttpServerService";
import { RedisService } from "../services/RedisService";
import { PersistenceService } from "../services/PersistenceService";
import { CompactorService } from "../services/CompactorService";
import { PubSubService } from "../services/PubSubService";
import { DocStoreService } from "../services/DocStoreService";
import { SocketHandlerService } from "../services/SocketHandlerService";

export const servicesStore = {
    databaseService: new DatabaseService(),
    httpServerService: new HttpServerService(),
    redisService: new RedisService(),
    persistenceService: new PersistenceService(),
    compactorService: new CompactorService(),
    pubSubService: new PubSubService(),
    docStoreService: new DocStoreService(),
    socketHandlerService: new SocketHandlerService(),
};
