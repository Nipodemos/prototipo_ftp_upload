import * as vscode from 'vscode';
import * as path from 'node:path';
import {
	getDefaultFtpServer,
	getDefaultFtpServerName,
	getFtpServers,
	type FtpServerConfig,
	validateDefaultFtpServer,
	validateFtpServer
} from './config';
import { downloadFileFromFtp } from './ftpClient';

function getTargetFileUri(resource?: vscode.Uri): vscode.Uri | undefined {
	if (resource?.scheme === 'file') {
		return resource;
	}

	const activeUri = vscode.window.activeTextEditor?.document.uri;
	if (activeUri?.scheme === 'file') {
		return activeUri;
	}

	return undefined;
}

function toRemotePath(localFileUri: vscode.Uri, remoteBasePath: string): string {
	const workspaceFolder = vscode.workspace.getWorkspaceFolder(localFileUri);
	const localFilePath = localFileUri.fsPath;
	const localRelativePath = workspaceFolder
		? path.relative(workspaceFolder.uri.fsPath, localFilePath)
		: path.basename(localFilePath);

	const relativePosix = localRelativePath.split(path.sep).join('/');
	const normalizedBase = remoteBasePath.replace(/\\/g, '/').replace(/\/+$/, '') || '/';

	if (relativePosix === '') {
		return normalizedBase;
	}

	return path.posix.join(normalizedBase, relativePosix);
}

async function downloadSelectedFileFromServer(
	server: FtpServerConfig,
	resource?: vscode.Uri
): Promise<void> {
	const validationErrors = validateFtpServer(server);
	if (validationErrors.length > 0) {
		vscode.window.showErrorMessage(`Servidor "${server.name}": ${validationErrors.join(', ')}`);
		return;
	}

	if (server.protocol !== 'ftp') {
		vscode.window.showErrorMessage(
			`Protocolo "${server.protocol}" ainda não suportado no download. Use um servidor com protocolo "ftp".`
		);
		return;
	}

	const targetUri = getTargetFileUri(resource);
	if (!targetUri) {
		vscode.window.showWarningMessage(
			'Nenhum arquivo local selecionado no editor. Abra ou selecione um arquivo e tente novamente.'
		);
		return;
	}

	const activeDoc = vscode.window.activeTextEditor?.document;
	if (activeDoc && activeDoc.uri.toString() === targetUri.toString() && activeDoc.isDirty) {
		const choice = await vscode.window.showWarningMessage(
			'O arquivo atual tem alterações não salvas e será sobrescrito pelo download. Continuar?',
			'Continuar'
		);
		if (choice !== 'Continuar') {
			return;
		}
	}

	const remoteFilePath = toRemotePath(targetUri, server.remotePath);

	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: `FTP: baixando ${path.basename(targetUri.fsPath)} de ${server.name}`
		},
		async () => {
			await downloadFileFromFtp({
				host: server.host,
				port: server.port,
				username: server.username,
				password: server.password,
				remoteFilePath,
				localFilePath: targetUri.fsPath
			});
		}
	);

	vscode.window.showInformationMessage(
		`Download concluído: ${server.name} -> ${path.basename(targetUri.fsPath)}`
	);
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Extensão "FTP Upload" ativa!');

	// Comando para listar os servidores FTP configurados
	const listServersCmd = vscode.commands.registerCommand('ftpUpload.listServers', async () => {
		const servers = getFtpServers();

		if (servers.length === 0) {
			const openSettings = 'Abrir Settings';
			const choice = await vscode.window.showWarningMessage(
				'Nenhum servidor FTP configurado. Configure em Settings > FTP Upload.',
				openSettings
			);
			if (choice === openSettings) {
				vscode.commands.executeCommand('workbench.action.openSettings', 'ftpUpload.servers');
			}
			return;
		}

		// Valida todos os servidores
		let hasErrors = false;
		for (const server of servers) {
			const errors = validateFtpServer(server);
			if (errors.length > 0) {
				hasErrors = true;
				vscode.window.showErrorMessage(
					`Servidor "${server.name || '(sem nome)'}": ${errors.join(', ')}`
				);
			}
		}

		if (hasErrors) {
			return;
		}

		const defaultErrors = validateDefaultFtpServer();
		if (defaultErrors.length > 0) {
			vscode.window.showErrorMessage(defaultErrors.join(' '));
			return;
		}

		const defaultServerName = getDefaultFtpServerName();

		// Mostra um QuickPick com os servidores configurados
		const items = servers.map(s => ({
			label: s.name,
			description: `${s.protocol}://${s.host}:${s.port}`,
			detail: `Diretório remoto: ${s.remotePath}${defaultServerName === s.name ? ' (Padrão)' : ''}`,
			server: s
		}));

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: 'Selecione um servidor FTP',
			title: 'Servidores FTP Configurados'
		});

		if (selected) {
			vscode.window.showInformationMessage(
				`Servidor selecionado: ${selected.server.name} (${selected.server.host})`
			);
			// TODO: Aqui será implementada a lógica de upload
		}
	});

	const downloadDefaultCmd = vscode.commands.registerCommand('ftpUpload.downloadDefault', async (resource?: vscode.Uri) => {
		try {
			const defaultErrors = validateDefaultFtpServer();
			if (defaultErrors.length > 0) {
				vscode.window.showErrorMessage(defaultErrors.join(' '));
				return;
			}

			const defaultServer = getDefaultFtpServer();
			if (!defaultServer) {
				vscode.window.showWarningMessage(
					'Nenhum servidor padrão configurado. Defina "ftpUpload.defaultServer" no settings.json.'
				);
				return;
			}

			await downloadSelectedFileFromServer(defaultServer, resource);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Falha no download FTP padrão: ${message}`);
		}
	});

	const downloadSelectCmd = vscode.commands.registerCommand('ftpUpload.downloadSelect', async (resource?: vscode.Uri) => {
		try {
			const servers = getFtpServers();
			if (servers.length === 0) {
				vscode.window.showWarningMessage(
					'Nenhum servidor FTP configurado. Configure "ftpUpload.servers" no settings.json.'
				);
				return;
			}

			for (const server of servers) {
				const errors = validateFtpServer(server);
				if (errors.length > 0) {
					vscode.window.showErrorMessage(`Servidor "${server.name || '(sem nome)'}": ${errors.join(', ')}`);
					return;
				}
			}

			const defaultServerName = getDefaultFtpServerName();
			const items = servers.map(server => ({
				label: server.name,
				description: `${server.protocol}://${server.host}:${server.port}`,
				detail: `${server.remotePath}${server.name === defaultServerName ? ' (Padrão)' : ''}`,
				server
			}));

			const selected = await vscode.window.showQuickPick(items, {
				placeHolder: 'Selecione o servidor FTP para download'
			});
			if (!selected) {
				return;
			}

			await downloadSelectedFileFromServer(selected.server, resource);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Falha no download FTP: ${message}`);
		}
	});

	const uploadDefaultCmd = vscode.commands.registerCommand('ftpUpload.uploadDefault', async () => {
		const defaultErrors = validateDefaultFtpServer();
		if (defaultErrors.length > 0) {
			vscode.window.showErrorMessage(defaultErrors.join(' '));
			return;
		}

		const defaultServer = getDefaultFtpServer();
		if (!defaultServer) {
			vscode.window.showWarningMessage(
				'Nenhum servidor padrão configurado. Defina "ftpUpload.defaultServer" no settings.json.'
			);
			return;
		}

		vscode.window.showInformationMessage(
			`Upload para FTP padrão (em breve): ${defaultServer.name}`
		);
	});

	const uploadSelectCmd = vscode.commands.registerCommand('ftpUpload.uploadSelect', async () => {
		vscode.window.showInformationMessage('Upload para FTP... (em breve).');
	});

	context.subscriptions.push(
		listServersCmd,
		downloadDefaultCmd,
		downloadSelectCmd,
		uploadDefaultCmd,
		uploadSelectCmd
	);
}

export function deactivate() {}
