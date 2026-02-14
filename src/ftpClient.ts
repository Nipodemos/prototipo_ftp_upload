import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client } from 'basic-ftp';

interface FtpConnectionOptions {
	host: string;
	port: number;
	username: string;
	password: string;
	timeoutMs?: number;
}

export interface FtpDownloadOptions extends FtpConnectionOptions {
	remoteFilePath: string;
	localFilePath: string;
}

export interface FtpUploadOptions extends FtpConnectionOptions {
	localFilePath: string;
	remoteFilePath: string;
}

export class FTPClient {
	private readonly client: Client;

	constructor(timeoutMs: number) {
		this.client = new Client(timeoutMs);
	}

	public async connect(host: string, port: number, username: string, password: string): Promise<void> {
		await this.client.access({
			host,
			port,
			user: username,
			password,
			secure: false
		});
	}

	public async downloadFile(remoteFilePath: string, localFilePath: string): Promise<void> {
		await this.client.downloadTo(localFilePath, remoteFilePath);
	}

	public async uploadFile(localFilePath: string, remoteFilePath: string): Promise<void> {
		await this.client.ensureDir(path.posix.dirname(remoteFilePath));
		await this.client.uploadFrom(localFilePath, remoteFilePath);
	}

	public close(): void {
		this.client.close();
	}
}

export async function downloadFileFromFtp(options: FtpDownloadOptions): Promise<void> {
	const timeoutMs = options.timeoutMs ?? 15000;
	const client = new FTPClient(timeoutMs);

	try {
		await fs.promises.mkdir(path.dirname(options.localFilePath), { recursive: true });

		await client.connect(options.host, options.port, options.username, options.password);
		await client.downloadFile(options.remoteFilePath, options.localFilePath);
	} finally {
		client.close();
	}
}

export async function uploadFileToFtp(options: FtpUploadOptions): Promise<void> {
	const timeoutMs = options.timeoutMs ?? 15000;
	const client = new FTPClient(timeoutMs);

	try {
		await client.connect(options.host, options.port, options.username, options.password);
		await client.uploadFile(options.localFilePath, options.remoteFilePath);
	} finally {
		client.close();
	}
}
