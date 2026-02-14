import * as vscode from 'vscode';

export interface FtpServerConfig {
	/** Nome amigável para identificar o servidor */
	name: string;
	/** Endereço do servidor FTP (ex: ftp.exemplo.com) */
	host: string;
	/** Porta do servidor FTP (padrão: 21) */
	port: number;
	/** Usuário para autenticação */
	username: string;
	/** Senha para autenticação */
	password: string;
	/** Diretório remoto para upload (ex: /public_html) */
	remotePath: string;
	/** Protocolo a ser usado */
	protocol: 'ftp' | 'sftp' | 'ftps';
}

const CONFIG_SECTION = 'ftpUpload';

/**
 * Retorna a lista de servidores FTP configurados nas settings do VS Code.
 */
export function getFtpServers(): FtpServerConfig[] {
	const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
	const servers = config.get<FtpServerConfig[]>('servers', []);
	return servers;
}

/**
 * Retorna o nome configurado como servidor FTP padrão.
 */
export function getDefaultFtpServerName(): string {
	const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
	const defaultServer = config.get<string>('defaultServer', '');
	return defaultServer.trim();
}

/**
 * Retorna o servidor FTP padrão configurado, se existir.
 */
export function getDefaultFtpServer(): FtpServerConfig | undefined {
	const defaultServerName = getDefaultFtpServerName();
	if (!defaultServerName) {
		return undefined;
	}

	return getFtpServerByName(defaultServerName);
}

/**
 * Retorna um servidor FTP pelo nome.
 */
export function getFtpServerByName(name: string): FtpServerConfig | undefined {
	const servers = getFtpServers();
	return servers.find(s => s.name === name);
}

/**
 * Valida se um servidor FTP tem todos os campos obrigatórios preenchidos.
 */
export function validateFtpServer(server: FtpServerConfig): string[] {
	const errors: string[] = [];

	if (!server.name || server.name.trim() === '') {
		errors.push('O campo "name" é obrigatório.');
	}
	if (!server.host || server.host.trim() === '') {
		errors.push('O campo "host" é obrigatório.');
	}
	if (!server.username || server.username.trim() === '') {
		errors.push('O campo "username" é obrigatório.');
	}
	if (!server.password || server.password.trim() === '') {
		errors.push('O campo "password" é obrigatório.');
	}
	if (!server.remotePath || server.remotePath.trim() === '') {
		errors.push('O campo "remotePath" é obrigatório.');
	}
	if (!['ftp', 'sftp', 'ftps'].includes(server.protocol)) {
		errors.push('O campo "protocol" deve ser "ftp", "sftp" ou "ftps".');
	}

	return errors;
}

/**
 * Valida a configuração de servidor FTP padrão.
 */
export function validateDefaultFtpServer(): string[] {
	const errors: string[] = [];
	const defaultServerName = getDefaultFtpServerName();

	if (!defaultServerName) {
		return errors;
	}

	const defaultServer = getFtpServerByName(defaultServerName);
	if (!defaultServer) {
		errors.push(
			`O servidor padrão "${defaultServerName}" não foi encontrado em "ftpUpload.servers".`
		);
	}

	return errors;
}
