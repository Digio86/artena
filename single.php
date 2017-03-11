<?php get_header(); ?>

<div id="single-post" role="main">

<?php do_action( 'foundationpress_before_content' ); ?>
<?php while ( have_posts() ) : the_post(); ?>
	<article <?php post_class('main-content') ?> id="post-<?php the_ID(); ?>">
		<header>
			<h1 class="entry-title"><?php the_title(); ?></h1>
		</header>
		<?php do_action( 'foundationpress_post_before_entry_content' ); ?>
		<div class="entry-content">
			<?php the_content(); ?>
		</div>

	</article>
<?php endwhile;?>

<?php do_action( 'foundationpress_after_content' ); ?>

</div>
<?php get_footer();
