import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client } from 'basic-ftp';

export interface FtpDownloadOptions {
	host: string;
	port: number;
	username: string;
	password: string;
	remoteFilePath: string;
	localFilePath: string;
	timeoutMs?: number;
}

class SimpleFtpClient {
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

	public async download(remoteFilePath: string, localFilePath: string): Promise<void> {
		await this.client.downloadTo(localFilePath, remoteFilePath);
	}

	public quit(): void {
		this.client.close();
	}
}

export async function downloadFileFromFtp(options: FtpDownloadOptions): Promise<void> {
	const timeoutMs = options.timeoutMs ?? 15000;
	const client = new SimpleFtpClient(timeoutMs);

	try {
		await fs.promises.mkdir(path.dirname(options.localFilePath), { recursive: true });

		await client.connect(options.host, options.port, options.username, options.password);
		await client.download(options.remoteFilePath, options.localFilePath);
	} finally {
		client.quit();
	}
}
