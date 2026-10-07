#!/usr/bin/env python3
"""Clean generated source-folder residue and Git index. Never build, push or release."""
import argparse,datetime,json,os,shutil,subprocess,tarfile,tempfile
from pathlib import Path
RESIDUE=['data/backups','data/storage-core-foundation-test','dist','out','release','.cache','coverage','.office-release-backups','.workshop-release-backups','.recovery-backups','.shell-release-backups','.storage-root-backups','.webstudio-release-backups','.template-release-backups','.office-backups','.chat-backups','checkpoints','_checkpoints','_archive','_archive_project_cleanup','_patches']
PROTECTED={'account-secure-v1.json','identity-secure-v1.json','identity-account-public-v1.json','storage-secret.key'}
def command(root,*args):return subprocess.run(['git','-C',str(root),*args],stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True)
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);p.add_argument('--apply',action='store_true');a=p.parse_args();root=a.root.resolve()
 if json.loads((root/'package.json').read_text()).get('name')!='irgeztne-workspace':raise ValueError('Expected existing Workspace source directory')
 gitroot=Path(command(root,'rev-parse','--show-toplevel').stdout.decode().strip()).resolve()
 if gitroot!=root:raise ValueError('Workspace must be its own Git repository; nested/combined repositories are refused')
 selected=[];protected=[]
 for name in RESIDUE:
  target=root/name
  if not target.exists():continue
  if target.is_symlink():raise ValueError('Refused residue symlink: '+name)
  unsafe=False
  for d,dirs,files in os.walk(target,followlinks=False):
   for n in dirs+files:
    f=Path(d)/n
    if f.is_symlink():raise ValueError('Refused residue symlink')
    if n in PROTECTED or n=='.env' or n.startswith('.env.') or f.suffix in ('.pem','.key'):unsafe=True
  if unsafe:protected.append(name)
  else:selected.append(target)
 tracked=[s for s in command(root,'ls-files','-z').stdout.split(b'\0') if s]
 excluded=[]
 for i in range(0,len(tracked),100):
  paths=[s.decode() for s in tracked[i:i+100]]
  result=subprocess.run(['git','-C',str(root),'check-ignore','--no-index','-z','--stdin'],input=b'\0'.join(t.encode() for t in paths)+b'\0',stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  if result.returncode not in (0,1):raise ValueError('Git ignore check failed')
  excluded.extend(s.decode() for s in result.stdout.split(b'\0') if s)
 print('Generated/history folders to remove from source:',len(selected));print('Excluded tracked files to remove from Git index:',len(excluded))
 if protected:print('Folders kept because they contain protected local files:',', '.join(protected))
 if not a.apply:return 0
 stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S');checkpoint=Path(tempfile.mkdtemp(prefix='IRGEZTNE-before-source-cleanup-'+stamp+'-',dir=root.parent));os.chmod(checkpoint,0o700)
 if selected:
  archive=checkpoint/'source-residue.tar.gz'
  with tarfile.open(archive,'w:gz') as t:
   for target in selected:t.add(target,arcname=target.name,recursive=True)
  os.chmod(archive,0o600)
  with tarfile.open(archive,'r:gz') as t:
   for member in t:
    if member.isfile():
     stream=t.extractfile(member)
     while stream.read(1024*1024):pass
  for target in selected:shutil.rmtree(target)
 if excluded:
  indexPath=Path(command(root,'rev-parse','--git-path','index').stdout.decode().strip());indexPath=indexPath if indexPath.is_absolute() else root/indexPath
  backup=checkpoint/'git-index-before';shutil.copyfile(indexPath,backup);os.chmod(backup,0o600)
  try:
   for i in range(0,len(excluded),100):command(root,'rm','--cached','--ignore-unmatch','-r','--',*excluded[i:i+100])
  except BaseException:shutil.copyfile(backup,indexPath);raise
 (checkpoint/'cleanup.json').write_text(json.dumps({'source':str(root),'archived_folders':[t.name for t in selected],'untracked_from_index':excluded,'kept_protected_folders':protected},indent=2))
 print('Source cleanup complete. One local checkpoint:',checkpoint)
 print('node_modules, app data/profile, Account/Identity, required resources and Git history were not deleted. No build, push or release was performed.')
 return 0
if __name__=='__main__':
 try:raise SystemExit(main())
 except Exception as e:print('STOP:',e);raise SystemExit(2)
