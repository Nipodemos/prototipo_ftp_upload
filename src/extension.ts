import * as vscode from 'vscode';
import { getFtpServers, validateDefaultFtpServer } from './config';
import {
	executeDiffCommand,
	getRemoteDiffSnapshot,
	registerRemoteDiffProvider,
	REMOTE_DIFF_SCHEME
} from './extension/diff';
import { executeDownloadCommand } from './extension/download';
import { getDefaultServerOrShow, pickServer, validateServersOrShow } from './extension/shared';

export function activate(context: vscode.ExtensionContext) {
	console.log('Extensão "FTP Upload" ativa!');

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

		if (!validateServersOrShow(servers, false)) {
			return;
		}

		const defaultErrors = validateDefaultFtpServer();
		if (defaultErrors.length > 0) {
			vscode.window.showErrorMessage(defaultErrors.join(' '));
			return;
		}

		const selectedServer = await pickServer(
			servers,
			'Selecione um servidor FTP',
			'Servidores FTP Configurados'
		);
		if (!selectedServer) {
			return;
		}

		vscode.window.showInformationMessage(
			`Servidor selecionado: ${selectedServer.name} (${selectedServer.host})`
		);
	});

	const downloadDefaultCmd = vscode.commands.registerCommand(
		'ftpUpload.downloadDefault',
		async (resource?: vscode.Uri) => {
			const defaultServer = getDefaultServerOrShow();
			if (!defaultServer) {
				return;
			}

			vscode.window.setStatusBarMessage(`FTP padrão: ${defaultServer.name}`, 3000);
			await executeDownloadCommand(defaultServer, resource, 'Falha no download FTP padrão');
		}
	);

	const downloadSelectCmd = vscode.commands.registerCommand(
		'ftpUpload.downloadSelect',
		async (resource?: vscode.Uri) => {
			const servers = getFtpServers();
			if (servers.length === 0) {
				vscode.window.showWarningMessage(
					'Nenhum servidor FTP configurado. Configure "ftpUpload.servers" no settings.json.'
				);
				return;
			}

			if (!validateServersOrShow(servers, true)) {
				return;
			}

			const selectedServer = await pickServer(servers, 'Selecione o servidor FTP para download');
			if (!selectedServer) {
				return;
			}

			await executeDownloadCommand(selectedServer, resource, 'Falha no download FTP');
		}
	);

	const diffDefaultCmd = vscode.commands.registerCommand(
		'ftpUpload.diffDefault',
		async (resource?: vscode.Uri) => {
			const defaultServer = getDefaultServerOrShow();
			if (!defaultServer) {
				return;
			}

			await executeDiffCommand(defaultServer, resource, 'Falha ao abrir diff com FTP padrão');
		}
	);

	const diffSelectCmd = vscode.commands.registerCommand('ftpUpload.diffSelect', async (resource?: vscode.Uri) => {
		const servers = getFtpServers();
		if (servers.length === 0) {
			vscode.window.showWarningMessage(
				'Nenhum servidor FTP configurado. Configure "ftpUpload.servers" no settings.json.'
			);
			return;
		}

		if (!validateServersOrShow(servers, true)) {
			return;
		}

		const selectedServer = await pickServer(servers, 'Selecione o servidor FTP para comparação');
		if (!selectedServer) {
			return;
		}

		await executeDiffCommand(selectedServer, resource, 'Falha ao abrir diff com FTP');
	});

	const downloadFromDiffCmd = vscode.commands.registerCommand(
		'ftpUpload.downloadFromDiff',
		async (resource?: vscode.Uri) => {
			const remoteUri = resource ?? vscode.window.activeTextEditor?.document.uri;
			if (!remoteUri || remoteUri.scheme !== REMOTE_DIFF_SCHEME) {
				vscode.window.showWarningMessage(
					'Esse comando só funciona no arquivo remoto aberto no diff do FTP.'
				);
				return;
			}

			const snapshot = getRemoteDiffSnapshot(remoteUri);
			if (!snapshot) {
				vscode.window.showWarningMessage(
					'Não foi possível recuperar os dados deste diff. Abra a comparação novamente.'
				);
				return;
			}

			await executeDownloadCommand(
				snapshot.server,
				snapshot.localFileUri,
				'Falha ao baixar a versão remota do diff'
			);
		}
	);

	const uploadDefaultCmd = vscode.commands.registerCommand('ftpUpload.uploadDefault', async () => {
		const defaultServer = getDefaultServerOrShow();
		if (!defaultServer) {
			return;
		}

		vscode.window.showInformationMessage(`Upload para FTP padrão (em breve): ${defaultServer.name}`);
	});

	const uploadSelectCmd = vscode.commands.registerCommand('ftpUpload.uploadSelect', async () => {
		vscode.window.showInformationMessage('Upload para FTP... (em breve).');
	});

	registerRemoteDiffProvider(context);

	context.subscriptions.push(
		listServersCmd,
		downloadDefaultCmd,
		downloadSelectCmd,
		diffDefaultCmd,
		diffSelectCmd,
		downloadFromDiffCmd,
		uploadDefaultCmd,
		uploadSelectCmd
	);
}

export function deactivate() {}
