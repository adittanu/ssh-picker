import type { Database } from '../connection.js';
import type { CreateServerInput, ServerRecord } from '../../shared/types.js';
export declare class ServerRepository {
    private readonly db;
    constructor(db: Database);
    create(input: CreateServerInput): ServerRecord;
    list(): ServerRecord[];
    findById(id: number): ServerRecord;
    findByName(name: string): ServerRecord;
    remove(id: number): void;
    update(id: number, input: Partial<CreateServerInput>): ServerRecord;
    recordConnection(id: number, action: string, localPath?: string, remotePath?: string): void;
}
